# Stack 設計書 — 装備チェックの Undo(Phase 2 / Priority 3-6)

作成: 2026-09-04
状態: **仕様確定**。この文書は実装の仕様書であり、実装者(Opus)はこれを正とする。
逸脱する場合は先に理由を説明して合意を取る。レビュー(Fable)は第10節で行う。

---

## 0. なぜこれを作るか

Priority 3 で Queue(`docs/QUEUE_DESIGN.md`)は「積む / 取り出す」を自分で書き、必要性まで実測した。
一方 Stack は Job テーブルの取り出し順を `id desc` に変えて順序が逆になるのを見ただけで、
**push / pop を書いておらず、「Stack でなければ困る場面」も体験していない**。

Stack の本質は LIFO という順序そのものではなく、**「直前の状態に戻る」という用途に LIFO が必然的に合う**こと。
これを体感するには「戻す対象がある機能」が要る。gear-list には**装備チェックの Undo**という
自然な題材がある:

```
ヘルメット ✓ → push({itemId:1, before:false})
ザック     ✓ → push({itemId:8, before:false})
ストック   ✓ → push({itemId:10, before:false})
[元に戻す]   → pop() → {itemId:10, before:false} → PATCH /items/10 {checked:false}
```

戻すのは**必ずストックから**。Queue(先頭から取る)で戻すとヘルメットが取り消されて操作順が破綻する。
**Queue と Stack を取り違えると壊れる**ことを、自分のコードで確認できる。

### Queue との対比(この実装で説明できるようになること)

| | Queue(3-3 で実装) | Stack(今回) |
|---|---|---|
| 操作 | enqueue(末尾に足す)/ claim(先頭から取る) | push(上に積む)/ pop(上から取る) |
| 置き場所 | DB(`Job` テーブル)— プロセスが落ちても残る | **メモリ(React state)** — リロードで消える |
| なぜその置き場所か | メール送信は「必ず届ける」仕事。永続化とリトライが必要 | Undo 履歴は「その画面を開いている間」だけ意味がある。エディタの Undo と同じ |
| 取り違えると | 古い仕事が永遠に後回し(V6 の LIFO メール) | 「戻す」が最初の操作に飛んで壊れる(第8節 V6) |

---

## 1. 決定事項

| # | 論点 | 決定 |
|---|---|---|
| 1 | 対象操作 | **チェックの ON/OFF のみ**。追加・削除・名称変更は対象外(削除の Undo は再作成が必要で規模が膨らむ) |
| 2 | Stack の実装 | `readonly T[]` を操作する**純粋関数**(`push` / `pop` / `peek` / `isEmpty`)。配列を破壊しない |
| 3 | 履歴の置き場所 | Client Component の `useState`(メモリ)。**永続化しない**(意図的。第0節の対比) |
| 4 | 履歴を持つ場所 | 新規 Client Component `ItemList` が所有し、各 `ItemCheckbox` と「元に戻す」ボタンで共有する |
| 5 | Undo 失敗時 | **先に pop してから API を呼ぶ**。対象が削除済み(404)でも履歴は進む(壊れた操作で詰まらせない) |
| 6 | Redo | **作らない**(スコープ外。作るなら2本目の Stack) |
| 7 | サーバー側 | **変更なし**。既存の `PATCH /api/items/:id` を使う |
| 8 | PR | 1本 `feature/undo-stack`(見込み差分 ~120 行 + docs) |

---

## 2. なぜ「純粋関数の Stack」なのか(React の制約)

React 公式は state に入れた配列を**不変として扱う**ことを求めている:

> "you should treat arrays in React state as read-only. … you shouldn't use methods that mutate the array, such as `push()` and `pop()`."
> "Instead, every time you want to update an array, you'll want to pass a *new* array to your state setting function."

公式の対応表: 追加は `push` ではなく `[...arr]` / `concat`、削除は `pop` / `shift` ではなく `slice` / `filter`。

したがって `class Stack { push() { this.items.push(x) } }` のような**破壊的な実装は React state と相性が悪い**。
「新しい配列を返す」関数として実装する。これは同時に、Queue との違いを1行で示せる利点がある:

```ts
pop(stack)     = { item: stack[stack.length - 1], stack: stack.slice(0, -1) }  // 末尾 = 最後に積んだもの
dequeue(queue) = { item: queue[0],                queue: queue.slice(1)      }  // 先頭 = 最初に積んだもの
```

**違いは「どちらの端から取るか」だけ。** それが用途の違い(公平な順番 vs 直前に戻る)を決める。

---

## 3. ファイル構成

| ファイル | 種別 | 内容 |
|---|---|---|
| `frontend/lib/stack.ts` | **新規** | `Stack<T>` 型と `emptyStack` / `push` / `pop` / `peek` / `isEmpty` / `size` |
| `frontend/components/ItemList.tsx` | **新規** | `"use client"`。履歴 state を所有。「元に戻す」ボタン + 装備一覧(page.tsx から移動) |
| `frontend/components/ItemCheckbox.tsx` | 変更 | `onToggled?: (before: boolean) => void` を追加し、更新成功時に呼ぶ |
| `frontend/app/lists/[id]/page.tsx` | 変更 | `<ul>…</ul>` を `<ItemList items={…} />` に置換。不要になった import を削除 |

**触らないファイル**: backend 全体 / `DeleteItemButton.tsx`(配置場所が ItemList 内に移るだけで中身は変えない)/ `lib/api.ts`

---

## 4. `lib/stack.ts` の仕様

```ts
// Stack は「後に積んだものを先に取り出す」(LIFO)データ構造。
// React state に入れるため、配列を破壊せず常に新しい配列を返す純粋関数として実装する
export type Stack<T> = readonly T[];

export function emptyStack<T>(): Stack<T>;                                  // []
export function push<T>(stack: Stack<T>, item: T): Stack<T>;                // [...stack, item]
export function pop<T>(stack: Stack<T>): { item: T | undefined; stack: Stack<T> };
                                                                            // 末尾を取り出し、残りを新しい配列で返す。空なら item は undefined、stack はそのまま
export function peek<T>(stack: Stack<T>): T | undefined;                    // 末尾を見るだけ(取り出さない)
export function isEmpty<T>(stack: Stack<T>): boolean;
export function size<T>(stack: Stack<T>): number;
```

**制約**: `import` なし・enum なし(第8節 V6 で Node が直接実行するため。Node 22.18+ の型ストリップは enum 非対応)。

各関数の先頭に「なぜ配列を破壊しないか」「なぜ末尾を top とするか(`push`/`slice(0,-1)` が O(1) 相当で、先頭を top にすると毎回全要素がずれる)」をコメントで書く。

---

## 5. `components/ItemList.tsx` の仕様

```ts
"use client";
import type { GearItem } from "@/types/gear";

// 1回のチェック操作を「元に戻せる単位」として記録したもの
export type ToggleOp = {
  itemId: number;
  name: string;      // ボタンのラベルに出す(「元に戻す: ストック」)
  before: boolean;   // 操作の直前の checked 値。戻す = この値を PATCH する
};

type Props = { items: GearItem[] };
```

### state

- `history: Stack<ToggleOp>` — 初期値 `emptyStack()`
- `undoing: boolean` — 二重送信防止

### 構成(page.tsx の `<ul>` ブロックをそのまま移し、上に「元に戻す」ボタンを置く)

```
<div>
  <button
    type="button"
    onClick={handleUndo}
    disabled={isEmpty(history) || undoing}
    aria-label="直前のチェック操作を元に戻す"
  >
    {isEmpty(history) ? "元に戻す" : `元に戻す: ${peek(history)!.name}`}
  </button>
  <ul className="mt-6">
    {items.map((item) => (
      <li key={item.id} className=…(page.tsx から移動)>
        <label …>
          <ItemCheckbox
            id={item.id}
            checked={item.checked}
            onToggled={(before) => recordToggle(item, before)}
          />
          <span …>{item.name} ×{item.quantity}</span>
        </label>
        <DeleteItemButton id={item.id} name={item.name} />
      </li>
    ))}
  </ul>
</div>
```

### `recordToggle(item, before)`

```ts
// 前の state を引数に取る関数形式で更新する(連続クリック時に古い history を上書きしないため)
setHistory((h) => push(h, { itemId: item.id, name: item.name, before }));
```

### `handleUndo()`

```
1. const { item: op, stack: rest } = pop(history)
2. op が undefined なら return(ボタンは disabled なので通常来ない)
3. setHistory(rest); setUndoing(true)      ← 先に pop する(決定事項5)
4. try   { await updateItem(op.itemId, { checked: op.before }); router.refresh() }
   catch { window.alert(err.message ?? "元に戻せませんでした") }
   finally { setUndoing(false) }
```

**先に pop する理由をコメントで書く**: 対象が削除済みなら PATCH は 404 で失敗する。その操作を履歴に残したままだと、
以降ずっと同じ失敗を繰り返して Undo が詰まる。「戻せない操作は捨てて次へ進む」方が利用者の期待に合う。

### なぜ履歴が `router.refresh()` で消えないか(コメントに書く)

`router.refresh()` は Server Component を再実行して `items` を差し替えるが、Next.js 公式は
「unaffected client-side React (e.g. `useState`) … を失わずにマージする」と明記している。
よって `ItemList` の `history` は refresh をまたいで保持される。**ページ全体のリロードでは消える**(意図どおり)。

---

## 6. 既存ファイルの変更

### `components/ItemCheckbox.tsx`

```ts
type Props = {
  id: number;
  checked: boolean;
  onToggled?: (before: boolean) => void;   // 追加。更新成功時に「操作前の値」を親へ通知する
};

// handleChange 内、updateItem 成功の直後・router.refresh() の前に:
onToggled?.(checked);   // checked はこの時点では「操作前の値」(props 由来で、まだ refresh されていない)
```

`onToggled` を optional にするのは、`ItemCheckbox` を履歴なしで使う可能性を残すため(後方互換)。

### `app/lists/[id]/page.tsx`

**Before**(51〜67行): `<ul className="mt-6">…</ul>` ブロック全体
**After**:

```tsx
<ItemList items={list.items ?? []} />
```

import から `ItemCheckbox` / `DeleteItemButton` を削除し、`ItemList` を追加。
`page.tsx` は **Server Component のまま**(`"use client"` を付けない)。履歴を Client 側に閉じ込め、
表示データの取得はサーバーに残す — Phase 1 からの「表示は Server / 対話は Client」の分離を維持する。

---

## 7. 実装順序と担当(Opus への指示)

| 順 | 作業 | 担当 | 完了条件 |
|---|---|---|---|
| 0 | `git checkout -b feature/undo-stack`、frontend 起動(`npm run dev`)、backend/db 起動確認 | ユーザー | 3000/8787 応答 |
| 1 | `lib/stack.ts` を第4節どおりに実装 | **ユーザー**(push/pop が Stack の核心)。「書いて」と言われたら Opus | `tsc` 通過 + 第8節 V0 の単体検証 |
| 2 | `ItemList.tsx` を第5節どおりに実装 | Opus | `tsc` 通過 |
| 3 | `ItemCheckbox.tsx` に `onToggled` 追加、`page.tsx` を置換 | Opus | `tsc` / `eslint` 通過、画面が従来どおり表示される |
| 4 | 第8節 V1〜V6 を実施し結果を提示 | Opus(実行)+ ユーザー(観察) | 全件 PASS |
| 5 | TASKS.md の 3-6 を ✅ に更新し、検証結果と振り返りを追記 | Opus | — |
| 6 | コミット → PR(第9節) | ユーザー | — |

**Opus が守ること**
- 各ステップで「何をしているか / なぜ必要か」を説明する。Rails 対比: Stack はコールスタックそのもの(`raise` で巻き戻る順)、Undo は Papertrail 的な履歴を「直前1件だけ」持つ形
- コミット・push は行わない(ユーザーが実行)
- backend / `lib/api.ts` / `DeleteItemButton.tsx` を触らない
- `any` 禁止。`Stack<T>` のジェネリクスを維持する
- **`stack.ts` で `Array.prototype.push` / `pop` を使わない**(React 公式の禁止事項。`[...arr]` / `slice` を使う)

---

## 8. 検証手順と期待結果(Fable のチェック基準)

前提: `test@example.com / password123` でログインし、`/lists/1`(夏山日帰り)を開く。
検証後は `cd backend && npx prisma db seed` でチェック状態を初期化する。

### V0: `stack.ts` 単体(Node が `.ts` を直接実行できる — Node 22.18+ で型ストリップが既定で有効)

一時ファイル `frontend/lib/__stack_check.ts` を作り(**コミットしない**)、実行後に削除する:

```ts
import { emptyStack, push, pop, peek, isEmpty, size } from "./stack.ts";   // 拡張子 .ts 必須
let s = emptyStack<string>();
s = push(s, "helmet"); s = push(s, "zack"); s = push(s, "stock");
console.log(size(s), peek(s));                 // 期待: 3 stock
const a = pop(s); console.log(a.item, size(a.stack), size(s));   // 期待: stock 2 3  ← 元の s は変わらない
const b = pop(a.stack); const c = pop(b.stack); const d = pop(c.stack);
console.log(b.item, c.item, d.item, isEmpty(d.stack));           // 期待: zack helmet undefined true
```

```bash
cd frontend && node lib/__stack_check.ts && rm lib/__stack_check.ts
```

`size(s)` が **3 のまま**であること(= 元の配列を破壊していない)が最重要。

### V1: 順序が逆になる(最重要)

ブラウザで ヘルメット → ザック → ストック の順にチェック(3回)。「元に戻す」を3回押す。

| 期待 | 根拠 |
|---|---|
| ボタンのラベルが順に `元に戻す: ストック` → `元に戻す: ザック` → `元に戻す: ヘルメット` | `peek` が末尾を返す |
| 戻る順が **ストック → ザック → ヘルメット** | LIFO |
| 3回目の後、ボタンが disabled | `isEmpty` |

DB でも確認: `curl -b cookie.txt http://localhost:8787/api/lists/1` の `items[].checked` が、各 Undo の後に該当アイテムだけ `false` に戻っている。
(cookie は `curl -c cookie.txt -X POST http://localhost:8787/api/auth/login -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"password123"}'` で取得)

### V2: 初期状態でボタンが disabled

ページを開いた直後、`元に戻す` が押せない。

### V3: 外す操作も戻せる

チェック済みのアイテムを**外す** → Undo → **付いた状態に戻る**(`before: true` が PATCH される)。

### V4: 削除済みアイテムの Undo で詰まらない(決定事項5)

アイテム X をチェック(履歴に積まれる)→ X を API で削除(`curl -b cookie.txt -X DELETE http://localhost:8787/api/items/<X>`)→ Undo。
期待: alert(404 のメッセージ)が出るが、**ボタンのラベルは次の操作に進んでいる**(履歴が pop 済み)。

### V5: リロードで履歴が消える(意図した挙動)

チェック2回 → ブラウザをリロード → ボタンが disabled。「Queue は DB、Stack はメモリ」の対比として記録する。

### V6: Queue と Stack を取り違えると壊れる(概念の実証)

一時スクリプト(コミットしない)で、**同じ操作列**を「末尾から取る(Stack)」と「先頭から取る(Queue)」で処理する:

```ts
// frontend/lib/__lifo_vs_fifo.ts
const ops = [
  { name: "helmet", before: false },
  { name: "zack",   before: false },
  { name: "stock",  before: false },
];
const asStack = [...ops]; const asQueue = [...ops];
console.log("Stack (pop):   最初に戻すのは", asStack.slice(-1)[0].name);   // 期待: stock
console.log("Queue (shift): 最初に戻すのは", asQueue[0].name);             // 期待: helmet ← 直前の操作ではない
```

`Queue` 側が `helmet` を返す = 「3つ前の操作」を先に取り消してしまう。これが取り違えの帰結。

### V7: 静的チェック・リグレッション

`cd frontend && npx tsc --noEmit && npx eslint .` エラーなし。チェック・追加・削除が従来どおり動く(削除は confirm があるため手動で確認)。

---

## 9. PR テンプレ(ユーザーが作成)

タイトル: `feat: 装備チェックのUndo(Stackによる操作履歴)を追加`

本文の必須項目: 概要 / 変更内容 / **設計判断**(純粋関数の Stack にした理由=React の不変性、履歴をメモリに置いた理由=Queue との対比、先に pop する理由)/ **動作確認**(V0〜V7)/ スコープ外(Redo、削除の Undo)/ 参照した一次情報(第11節)

PR 構成: 前回(#22 設計 → #23 実装)と違い規模が小さいため、**設計書 + 実装を1本**でよい。分けたい場合はユーザー判断。

---

## 10. Fable レビューチェックリスト

**stack.ts**
- [ ] `Array.prototype.push` / `pop` / `shift` / `splice` を**使っていない**(`[...s, x]` と `slice`)
- [ ] `pop` が `{ item, stack }` を返し、空のとき `item === undefined` かつ元の stack を返す
- [ ] `import` / enum が無く、V0 が Node 直接実行で通る
- [ ] ジェネリクス `Stack<T>` が保たれ `any` が無い

**ItemList.tsx**
- [ ] `"use client"` が1行目
- [ ] `setHistory((h) => push(h, op))` の**関数形式**で更新している
- [ ] `handleUndo` が **pop → setHistory → API** の順(API 成功を待ってから pop していない)
- [ ] ボタンが `isEmpty(history) || undoing` で disabled、ラベルに `peek` の name
- [ ] `<ul>` 以下の描画が旧 `page.tsx` と同一(className・DeleteItemButton の配置を含む)

**ItemCheckbox.tsx / page.tsx**
- [ ] `onToggled?.(checked)` が `updateItem` **成功後・`router.refresh()` 前**に呼ばれる
- [ ] `page.tsx` に `"use client"` が付いていない(Server Component のまま)
- [ ] `page.tsx` から `ItemCheckbox` / `DeleteItemButton` の import が消えている

**周辺**
- [ ] backend / `lib/api.ts` / `DeleteItemButton.tsx` に差分が無い
- [ ] `tsc` / `eslint` クリーン、V0〜V7 の結果が PR に記載

---

## 11. 参照した一次情報

- React - Updating Arrays in State(state の配列は read-only として扱い、`push`/`pop` ではなく spread/`slice` を使う): https://react.dev/learn/updating-arrays-in-state
- Next.js - useRouter(`router.refresh()` は `useState` などクライアント状態を失わずにマージする): https://nextjs.org/docs/app/api-reference/functions/use-router
- Node.js - Modules: TypeScript(型ストリップは v22.18.0 から既定で有効。import に `.ts` 拡張子必須、enum 非対応): https://nodejs.org/api/typescript.html
