# TASKS.md — 日次計画

方針: 期限2週間、**Day 10で完成**(4日前倒し)。Day 11-14はリファクタ・品質改善・stretch。
毎日: featureブランチ → 実装 → PR → セルフレビュー → merge。

## Phase 1: 環境構築 + Hono基礎 (Day 1-2)

- [ ] Day 1: `feature/setup-docker-postgres`
  - リポジトリ作成、docker-compose.ymlでPostgreSQL 16起動
  - 接続確認(psqlまたはTablePlus等)
- [ ] Day 2: `feature/setup-hono`
  - backend/ にHonoプロジェクト作成(@hono/node-server)
  - `GET /api/health` で `{ "status": "ok" }` を返す
  - 学習: ルーティング、c.json()、c.req.param()

## Phase 2: Prisma (Day 3-4)

- [ ] Day 3: `feature/prisma-schema`
  - Prisma導入、schema.prismaでGearList/GearItem定義(REQUIREMENTS.md参照)
  - `prisma migrate dev` 実行、Prisma Studioで確認
  - 学習: モデル定義、リレーション、onDelete: Cascade
- [ ] Day 4: `feature/prisma-seed`
  - seed.ts作成、夏山・冬山リスト投入
  - 学習: PrismaClientシングルトン、create/createMany

## Phase 3: API実装 (Day 5-7)

- [ ] Day 5: `feature/lists-read-api`
  - GET /lists, GET /lists/:id(include: items)
  - 404ハンドリング
- [ ] Day 6: `feature/lists-write-api`
  - POST / PATCH / DELETE /lists
  - Zodバリデーション導入(@hono/zod-validator)
  - 学習: zValidator、400レスポンス
- [ ] Day 7: `feature/items-api`
  - POST /lists/:listId/items, PATCH /items/:id, DELETE /items/:id
  - カスケード削除の動作確認

## Phase 4: フロントエンド (Day 8-9)

- [ ] Day 8: `feature/frontend-lists`
  - Next.jsセットアップ、lib/api.ts(fetchラッパー)
  - リスト一覧画面(/): 表示・作成・削除
- [ ] Day 9: `feature/frontend-detail`
  - リスト詳細画面(/lists/[id]): アイテム表示・追加・チェック切替・削除

## Phase 5: 完成 (Day 10)

- [ ] Day 10: `docs/readme` + 総点検
  - README作成(概要、技術スタック、ER図、セットアップ手順)
  - クリーンな環境でREADME手順通りに動くか検証

## Phase 6: バッファ (Day 11-14)

- [ ] リファクタリング(routes/services分離など)
- [ ] エラーハンドリング改善
- [ ] stretch着手(複製API or 合計重量) ※余裕がある場合のみ
- [ ] レビュー面談準備: 設計判断を口頭で説明する練習

## 進捗メモ

(日々の気づき・詰まった点をここに追記していく)

---

# Phase 1 実績(2026-08-16 追記)

上記 Day 1-14 計画に対する実績。**Phase 1 は完了**(PR #1〜#13 マージ済み、main は 4be3a28)。

| PR | 内容 |
|---|---|
| #1 | docker-compose で PostgreSQL 16 |
| #2 | Hono セットアップ + `GET /api/health` |
| #3 | Prisma スキーマ(GearList / GearItem, onDelete: Cascade)+ マイグレーション |
| #4 | `GET /api/lists` |
| #5 | `POST /api/lists` + Zod バリデーション導入 |
| #6 | `GET /api/lists/:id`(include: items) |
| #7 | `PATCH` / `DELETE /api/lists/:id` + 検証 hook 共通化 + INT4 上限チェック |
| #8 | seed(夏山日帰り21点 / 冬山日帰り20点) |
| #9 | CORS ミドルウェア(origin: localhost:3000) |
| #10 | Next.js セットアップ + リスト一覧画面(表示・作成・削除) |
| #11 | items API 3本(POST/PATCH/DELETE) |
| #12 | リスト詳細画面 + アイテム操作(追加・チェック切替・削除) |
| #13 | README(概要・ER図・API一覧・セットアップ手順・設計判断) |

未着手のまま残した項目(判断済み・優先度低):

- リスト編集 UI(`PATCH /api/lists/:id` は実装済み、画面から未接続)
- Stretch(リスト複製 API / 合計重量)
- 自動テスト(現状は curl とブラウザによる手動検証のみ)

---

# Phase 2 ロードマップ

方針の詳細は `CLAUDE.md` の「Phase 2 方針」を参照。
**前段階を理解してから次へ進む。**先の機能を急いで実装しない。

> **位置づけの修正(2026-08-29)**: 8/17 面談の正確な内容が共有されたため、
> 当初の「Priority 1→4 を順に実装する」という直列ロードマップの位置づけを以下に修正した。
> **面談で必須とされたのは認証のみ**。メール・Queue/Stack・外部API連携は発展候補であり必須ではない。

| 項目 | 位置づけ(8/17 面談・面談後チャットより) | 状態 |
|---|---|---|
| Priority 1: 認証・認可 | **必須(面談で提示された課題)** | ✅ **実装完了**(PR #15〜#18)。振り返り 1-17 のみ後日 |
| メール機能 | 発展候補として実施。相談の上**メールアドレス確認**に決定 | ✅ **実装完了**(PR #20, #21)。振り返り 2-5 は後日 |
| Queue / Stack | 時間があれば。**まず概念理解**、できそうな範囲で実装もアリ。特定技術の指定なし | ✅ **完了**。Queue(3-1〜3-5、PR #22・#23、`docs/QUEUE_DESIGN.md`)+ Stack(3-6、装備チェックの Undo、`docs/STACK_DESIGN.md`) |
| 外部API連携等 | 発展候補。案は出してよいが実装前に必ず相談 | ⬜ 未着手 |

## Priority 1: 認証・認可

設計比較と推奨案は `docs/AUTH_DESIGN.md` を参照。
**方式が決定するまで本実装に入らない。**

| Phase | 内容 | 状態 |
|---|---|---|
| 1-1 | 現状調査(既存コード・依存・スキーマの確認) | ✅ 完了 |
| 1-2 | 認証方式の選定(候補比較 → 相談 → 決定) | ✅ 完了 → **DBセッション + HttpOnly Cookie / SameSite=None / 既存データは削除して再seed** |
| 1-3 | User / Session モデル設計、Prisma schema 変更案の確認 | ✅ 完了 |
| 1-4 | マイグレーション実行、既存 GearList との関連付け方針の確定 | ✅ 完了(`20260819122713_add_user_and_session`。既存3行は reset で破棄) |
| 1-5 | パスワードハッシュの実装(ライブラリ選定 → ハッシュ化 → 検証) | ✅ 完了(`lib/password.ts`。scrypt / salt 16B / timingSafeEqual。seed も対応) |
| 1-6 | ユーザー登録 API(`POST /api/auth/signup`) | ✅ 完了(201 / 409 重複 / 400。登録後そのままログイン状態にする) |
| 1-7 | ログイン API(`POST /api/auth/login`)+ Cookie 発行 | ✅ 完了(毎回新セッション発行=固定化対策。失敗理由を文面・時間とも秘匿) |
| 1-8 | ログアウト API(`POST /api/auth/logout`)+ Cookie 削除・セッション破棄 | ✅ 完了(204。DB のセッションも破棄) |
| 1-9 | 現在のユーザー取得 API(`GET /api/auth/me`) | ✅ 完了(200 / 401) |
| 1-10 | 認証 Middleware(未ログインは 401) | ✅ 完了(`middleware/auth.ts`。c.set/c.get で受け渡し) |
| 1-11 | GearList と User の関連付け(既存データの扱いを含む) | ✅ 完了(POST は userId をサーバー側で決定) |
| 1-12 | Authorization(所有者チェック。他人のデータは 403 または 404) | ✅ 完了(**404 を採用**。403 だと存在が漏れるため) |
| 1-13 | GearItem へのアクセス制御(親リストの所有者経由で判定) | ✅ 完了(where に `gearList: { userId }` を指定) |
| 1-14 | フロント: 登録・ログイン・ログアウト画面 | ✅ 完了(/login, /signup, LogoutButton) |
| 1-15 | フロント: 未ログイン時のリダイレクト、ログイン状態の表示 | ✅ 完了(未ログイン→/login、ログイン済み→/ の双方向) |
| 1-16 | セキュリティ検証(他ユーザーの ID 直接指定で取得/更新/削除できないか) | ✅ 完了(2026-08-29。全24件PASS: 未ログイン401×8 / 他ユーザー404×6 / userId注入不可 / 情報漏洩なし / データ無傷) |
| 1-17 | 振り返り: ブラウザ → Next.js → Hono → 認証 → Prisma → PostgreSQL を説明する | ⬜ **後日実施**(実装を先行する方針。認証課題の達成判定はこれを待たない) |

### 1-16 で必ず確認するケース

```
User A でログイン → GearList(id=X)を作成
User B でログイン → GET    /api/lists/X        → 見えてはいけない
                 → PATCH  /api/lists/X        → 更新できてはいけない
                 → DELETE /api/lists/X        → 削除できてはいけない
                 → POST   /api/lists/X/items  → 追加できてはいけない
                 → PATCH  /api/items/<Aのitem> → 更新できてはいけない
未ログイン        → 上記すべて 401
```

## Priority 2: メール送信

**位置づけ: 発展候補(必須ではない)。** 8/17 面談で「認証を入れた後にメール機能をつける」という案が口頭で出たもの。
何を送るか・どの技術/サービスを使うかは面談で指定されておらず、**着手する場合に相談して確定する**。
以下の表は検討の叩き台であり、確定仕様ではない。

| Phase | 内容 |
|---|---|
| 2-1 | ✅ 完了(2026-08-29 相談で**メールアドレス確認**に決定。パスワードリセットはやらない) |
| 2-2 | ✅ 完了(**Nodemailer + Mailpit** に決定。外部サービスは学習用途に過剰と判断) |
| 2-3 | ✅ 完了(PR F: Mailpit + lib/mail.ts + VerificationToken + signup で送信。検証API/フロントは次PR) |
| 2-4 | ✅ 完了(送信失敗でsignupを失敗させない設計。SMTP設定は環境変数化) |
| 2-5 | 振り返り: Webアプリ → 送信処理 → SMTP/サービス → 受信 を説明する(⬜ 後日実施) |

学習対象: SMTP とは何か / SMTPサーバーとは何か / メール送信ライブラリの役割 / SMTP認証 / FROM・TO / 送信失敗時の扱い / APIキー・SMTPパスワードの環境変数管理 / 開発環境でのメール確認方法

### 確認の強制度についての決定(2026-08-29)

**決定: 未確認のままでも全機能を利用できる仕様で確定とする(下表の①)。メール認証はこれで完了扱い。**

メール確認は「どこまで強制するか」で4段階ある。今回採用したのは①。

| パターン | 挙動 | 採否 |
|---|---|---|
| ① 確認しない | 登録即利用可。未確認バッジが出るだけ | **採用** |
| ② 一部機能だけ制限 | ログインは可。特定操作のみ確認必須 | 不採用 |
| ③ 確認するまでログイン不可 | Devise の confirmable のデフォルト相当 | 不採用 |
| ④ 確認するまで User を作らない | 「仮登録→本登録」。日本の会員サービスに多い | 不採用 |

採用理由: 学習目的は「メール送信の仕組み(SMTP / トークン / 使い捨て)を理解すること」であり、
ログイン制御まで混ぜると1つの変更が大きくなりすぎる。Phase 2 の「1ステップ = 1つの関心事」に従った。

**実装上の裏付け**(2026-08-29 にコードで確認):
`emailVerified` を参照しているのは `frontend/app/page.tsx` のバッジ表示のみ。
`middleware/auth.ts` の `requireAuth` はセッションの有効性だけを見ており、確認済みかは判定していない。

**この選択で受け入れた既知のリスク**(面談で聞かれたら自分から言えるようにしておく):

1. **他人のメールアドレスで登録できてしまう。** 第三者が victim@example.com で登録するとそのアカウントは
   普通に使え、本人は「既に登録されています」で登録できなくなる。メールアドレスを本人確認の材料として
   信用できない状態になる
2. **確認メールの再送手段が無い。** 送信に失敗したユーザーは確認を完了できない(3-1 の実測で顕在化)
3. 将来パスワードリセットを作る場合は、未確認アドレスを信用したままにできないため①の見直しが必要

見直す場合の最小案: ログインAPIと `requireAuth` に「未確認なら 403」を足す(③相当)+ 再送API。
ただし再送とセットでないとユーザーが詰むため、両方まとめて着手すること。

## Priority 3: 非同期処理・Queue / Stack

**位置づけ: 時間があれば取り組む。** 面談後チャットの「キューやスタックなどの概念を調べて理解する、
できそうな範囲で作ってみるのもアリ」を受けたもの。**実装は必須ではなく、まず概念の理解が先**。
AWS SQS は口頭面談での具体例であり使用必須ではない(Redis / BullMQ も同様に必須ではない)。
Stack(LIFO)も概念理解の対象に含める。

最初に理解したい問い:
**「メール送信を POST リクエストの中でそのまま実行すればいいのに、なぜ Queue を使うのか?」**

```
【同期】  登録 → DB保存 → メール送信 → 送信完了 → HTTPレスポンス
【非同期】登録 → DB保存 → QueueへJob追加 → HTTPレスポンス
                              ↓(別プロセス)
                          Worker → Job取得 → メール送信
```

| Phase | 内容 | 状態 |
|---|---|---|
| 3-1 | 同期/非同期の違いを、Priority 2 で作った実装を題材に理解する | ✅ 完了(2026-08-29。下記「3-1 実測結果」) |
| 3-2 | Queue 技術の比較・選定(下記) | ✅ 完了(2026-09-03)→ **PostgreSQL の Job テーブル**を採用。仕様は `docs/QUEUE_DESIGN.md` |
| 3-3 | Queue に Job を積む / Worker が処理する、最小構成の実装 | ✅ 完了(2026-09-03。下記「3-3/3-4 検証結果」) |
| 3-4 | リトライ・失敗時の扱い | ✅ 完了(2026-09-03。3-3 と同時に実装。V3 で 5s→10s→dead を実測) |
| 3-5 | 振り返り: HTTP Request → API → Queue → Worker → Job実行 を説明する | ✅ 完了(2026-09-03。下記「3-5 振り返り」) |
| 3-6 | **Stack の実装**: 装備チェックの Undo(操作履歴を LIFO で戻す) | ✅ 完了(2026-09-04。下記「3-6 検証結果」)。仕様は `docs/STACK_DESIGN.md` |

学習対象: Queue / Job / Worker / Producer・Consumer / FIFO / 非同期処理 / バックグラウンド処理 / リトライ / Job失敗時の扱い / 重複実行 / 冪等性 / タイムアウト / Dead Letter Queue の概念 / メリット・デメリット

**すべてを最初から実装しない。まず基本構造を理解する。**

### 3-1 実測結果(2026-08-29)

「なぜ Queue を使うのか」を頭で理解するのではなく体感するため、現在の `POST /api/auth/signup` の
応答時間を実測した(curl の `%{time_total}`、各3回の代表値)。

| 条件 | 応答時間 | HTTP |
|---|---|---|
| `GET /api/health`(DBもメールもなし) | 0.001s | 200 |
| `POST /api/auth/login`(scrypt あり・メール送信なし) | 0.30s | 200 |
| `POST /api/auth/signup`(scrypt + メール送信、Mailpit 正常) | 0.32s | 201 |
| `POST /api/auth/signup`(**SMTP が無応答**。Mailpit を `docker compose pause`) | **30.37s** | 201 |

読み取れること:

1. **ローカルでは問題が見えない。** Mailpit は同一ホストなので送信は約20ms。応答時間の大半(約290ms)は
   scrypt によるパスワードハッシュで、メールのコストはその陰に埋もれている
2. **メール送信は HTTP レスポンスの経路上にある。** `routes/auth.ts` の signup は
   `await sendVerificationEmail(...)` をレスポンスを返す前に実行するため、SMTP が遅ければその分ユーザーが待つ
3. **30秒待たされてもレスポンスは 201。** `try/catch` で握っているので登録自体は成功する。つまり
   「ユーザーは 0.3秒で終わった仕事のために 30秒スピナーを見せられ、しかも確認メールは届かない」
4. **失敗したメールは誰も再送しない。** VerificationToken は発行済みなのに送信だけ失敗しており、
   再送機能が無いためそのユーザーは確認を完了できない → **リトライの置き場所が無いことが本質的な問題**

これが Queue を使う動機そのもの。「レスポンスに必要な処理」と「後でやればいい処理」を分離し、
後者に**リトライと失敗の記録**の置き場所を与える。

### Queue 技術の選定(3-2 で比較)

いきなり AWS SQS ありきで進めない。候補(2番目は Claude からの追加提案):

| 候補 | 概要 | 追加インフラ | 学習で得られるもの |
|---|---|---|---|
| アプリ内で概念だけ再現(配列 + タイマー) | 外部依存ゼロ。Queue の考え方だけを最小コストで体験する | なし | FIFO/LIFO と Producer・Consumer の分離。ただしプロセスが落ちると Job が消えるため永続化・リトライは学べない |
| **PostgreSQL のテーブルを Queue にする**(`FOR UPDATE SKIP LOCKED`) | 既存 DB をそのまま Job ストアにする。Worker は別プロセスで起動 | **なし**(既存の db を使う) | Job テーブル設計 / 状態遷移 / リトライ回数 / DLQ 相当 / 排他制御を**自分で書く**ため、Queue の構成要素が最もよく分かる |
| Redis(生) | List を Queue として使う(LPUSH/RPOP)。Stack は LPUSH/LPOP、待受は BRPOP | Redis コンテナ | FIFO と LIFO の対比が最短で試せる。リトライ・可視性タイムアウトは自作 |
| BullMQ(Redis ベース) | Job/Worker/リトライ/遅延/優先度/repeatable が最初から揃う。Node の定番 | Redis コンテナ | 実務での書き方。ただし仕組みはライブラリの内側に隠れる |
| AWS SQS | 実務に最も近い。マネージドで DLQ・可視性タイムアウトが標準 | AWS アカウント + IAM | 可視性タイムアウト / at-least-once / FIFO キューの概念 |

比較の観点: 学習しやすさ / ローカル開発のしやすさ / **現在の Docker Compose との相性** / Next.js・Hono との相性 / 本番環境への発展性 / 実務での利用イメージ / インフラ構築コスト

**Claude の推奨: PostgreSQL のテーブルを Queue にする案。** 理由:

- **Docker Compose もインフラも変更せずに済む。** 既に db は動いており、Prisma schema に Job モデルを
  1つ足すだけ。CLAUDE.md で「先に合意が必要」としている構成変更に該当しない
- Phase 2 の目的は「仕組みを説明できること」。BullMQ は便利だが、リトライも DLQ もライブラリの内側で
  起きるため、**何を学ぶかという観点では目的に逆行する**
- `SKIP LOCKED` は PostgreSQL 公式が「キューのようなテーブルに複数のコンシューマがアクセスする際の
  ロック競合を回避する」用途として明記している正攻法であり、思いつきの自作ではない
- Stack(LIFO)との対比は、同じ Job テーブルを `ORDER BY id DESC` で引くだけで実験できる

**ただし採用は未決定。** 「実務での利用イメージ」を優先して Redis / BullMQ を選ぶ判断も十分あり得るため、
3-3 に進む前に相談する。

### 3-6 検証結果(2026-09-04)

実装は `docs/STACK_DESIGN.md` の仕様どおり。V0〜V7 を全件実施し、すべて PASS。

| # | 検証 | 結果 |
|---|---|---|
| V0 | `stack.ts` 単体(Node が `.ts` を直接実行) | `size/peek: 3 stock` / `pop1: stock 残り:2 元のsize:3`(**元の配列が壊れていない**)/ `pop2-4: zack helmet undefined 空か:true` |
| V1 | 順序が逆になる(最重要) | ヘルメット→ザック→ストックの順にチェック後、ラベルが `ストック` → `ザック` → `ヘルメット` と変化し、その順に戻った。3回目で disabled。DB も checked が 0 件に |
| V2 | 初期状態で disabled | `label="元に戻す" disabled=true` |
| V3 | 外す操作も戻せる | チェック済みのゲイターを外す → Undo → `checked=true` に復帰(`before: true` が書き戻された) |
| V4 | 削除済みアイテムでも詰まらない | GPS をチェック後に API で削除 → Undo で alert「アイテムが見つかりません」が出るが、**ラベルは次の「行動食」へ進む**。続けて Undo すると行動食は正常に戻った |
| V5 | リロードで履歴が消える | リロード後 `disabled=true`。DB のチェック状態は保持(意図どおり) |
| V6 | Queue と取り違えると壊れる | 同じ履歴を末尾から取ると `stock`(直前)、先頭から取ると `helmet`(**3つ前の操作**) |
| V7 | リグレッション | 装備の追加(20→21)・削除(21→20)が従来どおり。`tsc` / `eslint` クリーン |

#### Queue(3-3)との対比 — この実装で説明できるようになったこと

| | Queue(メール送信) | Stack(Undo) |
|---|---|---|
| 取り出す端 | 先頭(`slice(1)`)= 最初に積んだもの | 末尾(`slice(0,-1)`)= 最後に積んだもの |
| 置き場所 | **DB**(`Job` テーブル)。プロセスが落ちても残る | **メモリ**(`useState`)。リロードで消える(V5) |
| なぜその置き場所か | 「必ず届ける」仕事。永続化とリトライが必要 | 「その画面を開いている間」だけ意味がある。エディタの Undo と同じ |
| 取り違えると | 古い仕事が永遠に後回し(V6 の LIFO メール) | 3つ前の操作が先に取り消される(V6) |

**違いは配列のどちらの端から取るかだけ。** それが用途(公平な順番 vs 直前に戻る)を決める。

#### 実装上の要点

- **React state の配列は破壊しない。** 公式が `push`/`pop` の使用を禁じているため、`[...s, x]` と `slice` で新しい配列を返す純粋関数として実装した(`lib/stack.ts`)
- **`setHistory((h) => push(h, op))` の関数形式で更新。** `push(history, op)` を直接渡すと、素早く連続でチェックしたとき古い history を元にした更新で操作が失われる
- **API を呼ぶ前に pop する。** 対象が削除済みだと PATCH は 404 になるが、履歴に残すと以降ずっと同じ失敗を繰り返して Undo が詰まる(V4)
- **`page.tsx` は Server Component のまま。** 履歴を持つ `ItemList` だけを Client Component に切り出し、「表示は Server / 対話は Client」の分離を維持した

### 3-5 振り返り(2026-09-03)

面談で聞かれたときにそのまま答えられる形で残す。

#### 処理の流れ

```
① ブラウザ                POST /api/auth/signup
② Hono (routes/auth.ts)   ユーザー作成 → セッション発行 → トークン発行
   :87                    await enqueue("send_verification_email", {to, token})
③ Queue (lib/queue.ts:36) INSERT INTO "Job" (type, payload, status='pending')
   :90                    return c.json({...}, 201)   ← ここでレスポンスが返る(0.3秒)
   ══════════ HTTP リクエストはここで終わり。以降は別プロセス・別の時間軸 ══════════
④ Worker (worker.ts:91)   1秒ごとにポーリング → claimNextJob() で1件獲得
   worker.ts:52           processJob() → handlers[job.type] を呼ぶ
   lib/mail.ts            sendVerificationEmail() → SMTP → Mailpit
⑤ 結果                    成功 → completeJob() / 失敗 → failJob()(リトライ or dead)
```

**API と Worker は別プロセスで、繋がっているのは DB の `Job` テーブルだけ。**

#### Q1. なぜ Queue を使うのか

変更前は `await sendVerificationEmail()` が HTTP レスポンスの経路上にあった。SMTP が無応答だと
**30.37 秒**待たされ(3-1 実測)、しかも送信に失敗したメールは誰も再送しなかった。
Queue に積むだけにしたことで応答は **0.3 秒**(V1)になり、送信の失敗は Worker がリトライするようになった。
V4 では、3-1 なら失われていたメールが復旧後に自動で届くことを確認している。
要点は速度ではなく「**リトライと失敗の記録の置き場所ができた**」こと。

#### Q2. Producer と Consumer はどれか

- **Producer** = `routes/auth.ts:87` の `enqueue(...)`。仕事を積む側。DB への INSERT だけで一瞬で終わる
- **Consumer** = `worker.ts:91` の `while (running)` ループ。仕事を取り出して実行する側

#### Q3. なぜ Worker を2つ動かしても二重処理が起きないのか

`claimNextJob`(`queue.ts:54`)が2段構えになっている。候補を1件選んだあと、
**「まだ pending であること」を条件に** status を processing へ更新する:

```sql
UPDATE "Job" SET status='processing', attempts=attempts+1 WHERE id = 12 AND status = 'pending'
```

PostgreSQL はこの1文を不可分に実行するため、2つの Worker が同じ候補を見つけても
UPDATE が成立する(`count = 1`)のは先に到達した1つだけ。負けた方は `count = 0` になり諦める。
Rails の楽観ロック(`lock_version`)と同じ発想。V5 で実証(1号機 #10・#12 / 2号機 #11、重複ゼロ)。

#### Q4. FIFO と LIFO の使い分け

切り替えているのは `claimNextJob` の `orderBy: { id: asc | desc }` の1箇所だけ(`QUEUE_ORDER` で制御)。

- **FIFO(Queue)= メール送信はこちらであるべき。** 先に登録した人が先に受け取るのが公平。
  LIFO だと、混雑時に古い Job が延々と後回しにされ、最初に登録した人が最後まで待たされる
- **LIFO(Stack)が向くもの**: Undo 履歴、ブラウザの戻る、再帰呼び出しの管理。
  いずれも「直前のものから戻す」が正しい順序

V6 で実測: LIFO → `15→14→13` / FIFO → `16→17→18`。

#### Q5. なぜ `attempts` を claim 時に増やすのか(失敗時ではなく)

「取り出した = 1回試みた」と数えるため。失敗時に増やす設計だと、**処理中に Worker が
クラッシュした場合に試行回数が記録されず**、再起動のたびに何度でも同じ Job を試し続けてしまう。
claim 時に増やしておけば、たとえ途中で落ちても回数は DB に残る。
その代わり `failJob` では増やさない(二重加算になる)。

#### Q6. 可視性タイムアウトを実装しなかったことで何が起こりえるか

Worker が Job を processing にした直後にクラッシュすると、その Job は
**`processing` のまま永遠に誰にも拾われない**(`claimNextJob` は `status = pending` しか探さないため)。

実務での対処は「`startedAt` が N 分以上前の `processing` を pending に戻す」回収処理。
AWS SQS の Visibility Timeout、BullMQ の stalled job 検知が同じ役割を果たしている。
今回は 3 時間枠のため見送り、`startedAt` の記録だけ残した(`docs/QUEUE_DESIGN.md` 第9節)。

#### 補足: at-least-once(少なくとも1回)

メール送信に成功した直後・`completeJob` の前にクラッシュすると、その Job は
リトライ対象として残り、**同じメールが2通届く**可能性がある。
「1回ちょうど」を保証するのは分散システムでは非常に難しく、実務では
「**少なくとも1回は届く**」を保証したうえで、受け手側を冪等に作るのが定石。

### 3-3/3-4 検証結果(2026-09-03)

実装は `docs/QUEUE_DESIGN.md` の仕様どおり。検証は同文書 第8節の V1〜V6 を全件実施し、すべて PASS。

#### V1: 3-1 と同じ条件での比較(最重要)

`docker compose pause mailpit` で SMTP を無応答にしたうえで `POST /api/auth/signup` を3回。

| | 3-1(Queue 導入前) | 3-3(Queue 導入後) |
|---|---|---|
| 応答時間 | **30.37s** | **0.293 / 0.297 / 0.343s** |
| HTTP | 201 | 201 |
| メールの行方 | **永久に失われる**(再送手段なし) | Mailpit 復帰後に**3通とも自動で届いた** |

残る 0.3 秒は scrypt によるパスワードハッシュ。メール送信はレスポンス経路から完全に外れた。

#### V2〜V6

| # | 検証 | 結果 |
|---|---|---|
| V2 | 正常系 | 201 / 0.33s → `claimed → completed`、メール1通、`attempts=1` |
| V3 | リトライ→dead | `attempt=1/3 → retry in 5s` → `2/3 → retry in 10s` → `3/3 → dead`(実測17秒)。DB: `status=dead, attempts=3, lastError=ECONNREFUSED` |
| V4 | 復旧で成功 | 1回目失敗の直後に Mailpit を起動 → **2回目で completed、メール到着**(`attempts=2`) |
| V5 | Worker 2機の排他 | 1号機が job#10・#12、2号機が job#11。**二重 claim ゼロ**、メールちょうど3通、全て `attempts=1` |
| V6 | Stack vs Queue | LIFO: `15→14→13`(q6c→q6b→q6a)/ FIFO: `16→17→18`(q7a→q7b→q7c) |

リグレッション: login 200 / GET lists 200 / auth/me 200 / 未認証 lists 401 / health 200。`tsc --noEmit` エラーなし。

**V4 が Queue を導入した意味そのもの。** 3-1 では「30秒待たされた挙句メールは届かず、再送もされない」だったものが、
Worker が自動でリトライして届けた。「リトライの置き場所ができた」ことの実証。

#### 設計書からの逸脱(1件)

`worker.ts` の Job 処理関数を `process` ではなく **`processJob`** とした。`process` という名前で
トップレベル関数を宣言すると Node のグローバル `process` を上書きし、同じファイル内の
`process.on("SIGINT")` が壊れるため。`docs/QUEUE_DESIGN.md` 第5節の記載は修正済み。

### 3-2 決定(2026-09-03)

**PostgreSQL の Job テーブル方式を採用**(3時間枠で 3-3・3-4 まで通す前提)。
理由・簡略化した点(楽観ロック採用、可視性タイムアウトは対象外)・実装仕様・検証手順・レビュー基準は
すべて `docs/QUEUE_DESIGN.md` に集約。3-3 以降はその文書を正として進める。
Stack(LIFO)は同じ Job テーブルの取り出し順を `QUEUE_ORDER=lifo` で切り替えて対比する(同文書 V6)。

参照(一次情報):

- PostgreSQL 16 — SELECT / The Locking Clause: https://www.postgresql.org/docs/16/sql-select.html
  > "With `SKIP LOCKED`, any selected rows that cannot be immediately locked are skipped. Skipping locked rows provides an inconsistent view of the data, so this is not suitable for general purpose work, but can be used to avoid lock contention with multiple consumers accessing a queue-like table."
- Redis — Lists(Queue: LPUSH/RPOP、Stack: LPUSH/LPOP、ブロッキング: BRPOP): https://redis.io/docs/latest/develop/data-types/lists/
- BullMQ 公式ドキュメント: https://docs.bullmq.io/
- Amazon SQS Developer Guide — What is Amazon SQS?(visibility timeout / DLQ / Standard=at-least-once・FIFO=exactly-once): https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html

## Priority 4: 外部API連携などの発展実装

**位置づけ: 発展候補。** 面談後チャットの「外部API連携等、自分なりに(AIと相談しながら)考えて
実装をしてみるのもアリ」を受けたもの。特定の外部APIが課題として指定されたわけではない。
Claude から案を出す場合は「何を実装するか / gear-list とどう関係するか / 何を学べるか / 実装量・難易度」を
先に提示し、**相談して決めてから実装する**。AWS SQS などのマネージド Queue も、Priority 3 の理解後の選択肢の一つ。
