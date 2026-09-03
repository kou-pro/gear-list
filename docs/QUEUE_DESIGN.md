# Queue / Worker 設計書(Phase 2 / Priority 3)

作成: 2026-09-03
状態: **技術選定 決定済み**。この文書は実装の仕様書であり、実装者はこれを正とする。
逸脱する場合は先に理由を説明して合意を取る(実際に発生した逸脱は第5節のコメント参照)。

---

## 0. 最適性の判断(なぜこの設計か)

### 解く問題(TASKS.md「3-1 実測結果」より)

`POST /api/auth/signup` は `await sendVerificationEmail()` を **HTTP レスポンスの経路上**で実行している。
SMTP が無応答だと **30.37 秒**待たされ、しかも失敗したメールは誰も再送しない。
本質的な問題は「**リトライの置き場所が無い**」こと。

### 候補比較の結論

| 候補 | 3時間で実装可 | 学べること | 判定 |
|---|---|---|---|
| アプリ内配列 | ◎ 1h | FIFO/LIFO の形だけ。プロセス再起動で Job が消えるため**リトライ・永続化が学べない** | ✕ 問題を解決しない |
| **PostgreSQL の Job テーブル** | ◎ 3h | Job の状態遷移 / 排他 / リトライ / DLQ を**自分で書く** | **採用** |
| Redis / BullMQ | ○ 3h | ライブラリの使い方。仕組みは内側に隠れる | △ 目的に逆行 |
| AWS SQS | ✕ | 概念は最良だが AWS 設定に時間を食う | 後日 |

**採用理由(3点)**

1. **インフラ変更ゼロ**。既存の `db` をそのまま Job ストアにする。Prisma にモデルを1つ足すだけで、
   CLAUDE.md「先に合意が必要な変更」(Docker 構成変更・ライブラリ追加)に該当しない
2. **Phase 2 の目的は「仕組みを説明できること」**。BullMQ を使うとリトライも DLQ もライブラリの内側で起きる。
   自分で書けば「Job / Worker / Producer / Consumer / リトライ / Dead Letter」の全構成要素が手元にある
3. **PostgreSQL 公式が「queue-like table」用途を明記している正攻法**(`SKIP LOCKED`。第7節参照)。
   思いつきの自作ではなく、実務でも使われる構成(Rails の Solid Queue、Laravel の database driver 等が同じ発想)

### 3時間版での簡略化(意図的な設計判断)

| 実務の正攻法 | 今回 | 理由 |
|---|---|---|
| `SELECT ... FOR UPDATE SKIP LOCKED` | **楽観ロック**(`updateMany` の `count` で判定) | 生 SQL 不要で Prisma だけで書ける。**排他の本質(DB 側で不可分に UPDATE される)は同じ** |
| 可視性タイムアウト(処理中に Worker が落ちた Job の回収) | **実装しない**(`startedAt` だけ記録) | スコープ外として文書化。第9節 |
| 完了 Job の定期削除 | 実装しない | 同上 |

---

## 1. 決定事項

| # | 論点 | 決定 |
|---|---|---|
| 1 | Queue の実体 | PostgreSQL の `Job` テーブル(Prisma モデル追加) |
| 2 | Worker | 別プロセス `backend/src/worker.ts`。`npm run worker` で起動 |
| 3 | 排他制御 | 楽観ロック: `updateMany({ where: { id, status: "pending" } })` の `count === 1` で獲得成功とみなす |
| 4 | リトライ | 最大 **3 回**。待ち時間は **5s → 10s**(`5000 * 2^(attempts-1)` ms)。3回目失敗で `dead` |
| 5 | Dead Letter | 別テーブルは作らず `status = dead` + `lastError` で表現 |
| 6 | 取り出し順 | 既定 **FIFO**(`id asc`)。環境変数 `QUEUE_ORDER=lifo` で **LIFO**(`id desc`)に切替可(Stack 実験用) |
| 7 | ポーリング | Job があれば連続処理、無ければ **1 秒**待つ |
| 8 | 最初の Job 種別 | `send_verification_email` のみ |
| 9 | signup の変更 | `await sendVerificationEmail()` を **`enqueue()` に置き換え**。メール送信は Worker の責務にする |
| 10 | PR | **1本** `feature/job-queue`(見込み差分 ~180 行) |

---

## 2. スキーマ(最終形・コピペ可)

`backend/prisma/schema.prisma` に**追記**(既存モデルは触らない):

```prisma
// Job の状態。pending → processing → completed、または失敗して pending に戻る(リトライ)/ dead(諦め)
enum JobStatus {
  pending
  processing
  completed
  dead
}

// 「後でやる仕事」を1行1件で保存する。これが Queue の実体。
// HTTP リクエストの処理から切り離したい仕事(メール送信など)をここに積み、Worker が別プロセスで処理する
model Job {
  id          Int       @id @default(autoincrement())
  type        String    // "send_verification_email" など。Worker がこの値で処理を振り分ける
  payload     Json      // 仕事に必要なデータ(宛先・トークンなど)
  status      JobStatus @default(pending)
  attempts    Int       @default(0)  // 実行を試みた回数(獲得時に +1)
  maxAttempts Int       @default(3)
  runAt       DateTime  @default(now()) // この時刻以降に実行してよい。リトライの待ち時間はここで表現する
  lastError   String?   // 直近の失敗理由。dead になった原因を後から追える
  startedAt   DateTime? // 最後に処理を開始した時刻(将来の可視性タイムアウト用に記録だけする)
  completedAt DateTime?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // Worker は毎秒「pending かつ runAt <= now」を引くため、この複合インデックスが効く
  @@index([status, runAt])
}
```

マイグレーション名: `add_job_queue`(`npx prisma migrate dev --name add_job_queue`)

---

## 3. ファイル構成

| ファイル | 種別 | 内容 |
|---|---|---|
| `backend/prisma/schema.prisma` | 変更 | 第2節を追記 |
| `backend/src/lib/queue.ts` | **新規** | `enqueue` / `claimNextJob` / `completeJob` / `failJob` |
| `backend/src/worker.ts` | **新規** | ポーリングループ、種別ごとのハンドラ、graceful shutdown |
| `backend/src/routes/auth.ts` | 変更 | signup のメール送信を `enqueue` に置換(第5節) |
| `backend/prisma/seed.ts` | 変更 | `await prisma.job.deleteMany();` を `user.deleteMany()` の**前**に追加(Job は User と FK を持たないため Cascade で消えない) |
| `backend/package.json` | 変更 | `"worker": "tsx watch src/worker.ts"` を scripts に追加 |
| `backend/.env.example` | 変更 | `QUEUE_ORDER="fifo"` を追記(コメントで `lifo` に切替可と明記) |

**触らないファイル**: `lib/mail.ts`(送信処理はそのまま Worker から呼ぶ)/ `docker-compose.yml` / frontend 全体 / 既存ルート(auth.ts の signup 以外)

### import パス(検証済み)

`npx prisma migrate dev` 後、`client.ts` がモデル型と enum を再 export するため、以下で全部そろう:

```ts
import { prisma } from "./prisma.js";
import { JobStatus, Prisma, type Job } from "../generated/prisma/client.js";
```

- `Job` 型 … `export type Job = Prisma.JobModel` が生成される
- `JobStatus` … enum(値は `JobStatus.pending` 等)
- `Prisma.InputJsonValue` … `payload` に渡す型

---

## 4. `lib/queue.ts` の仕様

```ts
// ── 型 ──
export type JobType = "send_verification_email";

export type JobPayloads = {
  send_verification_email: { to: string; token: string };
};

export type QueueOrder = "fifo" | "lifo";

// ── 定数 ──
const BASE_RETRY_DELAY_MS = 5_000;

// ── 関数 ──
export async function enqueue<T extends JobType>(type: T, payload: JobPayloads[T]): Promise<Job>
export async function claimNextJob(order: QueueOrder): Promise<Job | null>
export async function completeJob(id: number): Promise<void>
export async function failJob(job: Job, error: unknown): Promise<"retry" | "dead">
export function retryDelayMs(attempts: number): number   // 5000 * 2 ** (attempts - 1)
```

### `enqueue`

`prisma.job.create({ data: { type, payload, status: pending } })`。`runAt` は default(now)。戻り値は作成した Job。

### `claimNextJob(order)` — 核心

```
1. candidate = findFirst({
     where: { status: pending, runAt: { lte: new Date() } },
     orderBy: { id: order === "lifo" ? "desc" : "asc" },
   })
2. candidate が無ければ null
3. result = updateMany({
     where: { id: candidate.id, status: pending },   // ← 「まだ pending であること」を条件に含める
     data:  { status: processing, attempts: { increment: 1 }, startedAt: new Date() },
   })
4. result.count === 0 なら null(他の Worker に先を越された。呼び出し側は次のループで再挑戦)
5. findUniqueOrThrow({ where: { id: candidate.id } }) で更新後の行を返す
```

**なぜこれで奪い合いが防げるか(コメントで必ず説明する)**:
手順3の `UPDATE ... WHERE id = ? AND status = 'pending'` は PostgreSQL が**1文として不可分に**実行する。
2つの Worker が同じ candidate を見つけても、UPDATE が成功する(count = 1)のは先に到達した1つだけ。
後から来た方は WHERE の `status = 'pending'` がもう偽なので count = 0 になる。

### `completeJob(id)`

`update({ where: { id }, data: { status: completed, completedAt: new Date() } })`

### `failJob(job, error)`

```
message = error instanceof Error ? error.message : String(error)
if (job.attempts >= job.maxAttempts):
  update → { status: dead, lastError: message }        return "dead"
else:
  update → { status: pending,                            // ← pending に戻す = リトライ
             runAt: new Date(Date.now() + retryDelayMs(job.attempts)),
             lastError: message }                         return "retry"
```

`attempts` は **claim 時に増やしている**ので、ここでは増やさない(二重加算に注意)。

期待される遷移(maxAttempts = 3):

| claim 回数 | attempts | 失敗したら |
|---|---|---|
| 1回目 | 1 | pending に戻し、runAt = now + **5s** |
| 2回目 | 2 | pending に戻し、runAt = now + **10s** |
| 3回目 | 3 | **dead** |

---

## 5. `worker.ts` の仕様

```ts
import "dotenv/config";     // ← 必ず1行目(prisma.ts が DATABASE_URL を読むため)
```

### 構成

```
const POLL_INTERVAL_MS = 1000
const order: QueueOrder = process.env.QUEUE_ORDER === "lifo" ? "lifo" : "fifo"

const handlers: { [T in JobType]: (payload: JobPayloads[T]) => Promise<void> } = {
  send_verification_email: ({ to, token }) => sendVerificationEmail(to, token),
}

let running = true
process.on("SIGINT",  () => { running = false })   // Ctrl+C で「今の Job を終えてから」止まる
process.on("SIGTERM", () => { running = false })

async function main() {
  log(`worker started (order=${order})`)
  while (running) {
    const job = await claimNextJob(order)
    if (!job) { await sleep(POLL_INTERVAL_MS); continue }   // 空なら1秒待つ
    await processJob(job)                                    // あれば連続処理(待たない)
  }
  log("worker stopped")
  await prisma.$disconnect()
}

// 関数名を process にしてはいけない。Node のグローバル process を上書きしてしまい、
// 同じファイル内の process.on("SIGINT") が壊れる
async function processJob(job) {
  log(`claimed job#${job.id} type=${job.type} attempt=${job.attempts}/${job.maxAttempts}`)
  const handler = handlers[job.type as JobType]
  if (!handler) {
    // 知らない種別はリトライしても直らないので即 dead
    await prisma.job.update({ where: { id: job.id }, data: { status: dead, lastError: `unknown job type: ${job.type}` } })
    log(`dead job#${job.id}: unknown type`)
    return
  }
  try {
    await handler(job.payload as JobPayloads[JobType])
    await completeJob(job.id)
    log(`completed job#${job.id}`)
  } catch (err) {
    const outcome = await failJob(job, err)
    if (outcome === "retry") log(`failed job#${job.id} attempt=${job.attempts}/${job.maxAttempts} → retry in ${retryDelayMs(job.attempts) / 1000}s: ${message}`)
    else                     log(`dead job#${job.id} after ${job.attempts} attempts: ${message}`)
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
```

### ログ形式(Fable が検証で参照するため固定)

すべて `[worker]` プレフィックス。以下の5種類:

```
[worker] started (order=fifo)
[worker] claimed job#12 type=send_verification_email attempt=1/3
[worker] completed job#12
[worker] failed job#12 attempt=1/3 → retry in 5s: connect ECONNREFUSED 127.0.0.1:1025
[worker] dead job#12 after 3 attempts: connect ECONNREFUSED 127.0.0.1:1025
```

---

## 6. `routes/auth.ts` signup の変更

**Before**(現在の 81〜86 行付近):

```ts
try {
  const token = await createVerificationToken(user.id);
  await sendVerificationEmail(user.email, token);
} catch (err) {
  console.error("確認メールの送信に失敗しました:", err);
}
```

**After**:

```ts
// メール送信はレスポンスを待たせないよう Queue に積むだけにする。
// 実際の送信(と失敗時のリトライ)は worker.ts の責務。
// enqueue は同じ DB への INSERT なので、これが失敗する状況では user.create も失敗している。
// 以前の try/catch(送信失敗を握りつぶす)は、リトライの置き場所ができたので不要になった
const token = await createVerificationToken(user.id);
await enqueue("send_verification_email", { to: user.email, token });
```

import の変更: `sendVerificationEmail` の import を削除し、`enqueue` を `../lib/queue.js` から import。
`sendVerificationEmail` は **worker.ts が** `../lib/mail.js` から import する。

---

## 7. 実装順序と担当(Opus への指示)

ハンズオン方針(CLAUDE.md「Claude の担当範囲」)に沿う。**必ずこの順で、1ステップごとに動作確認してから次へ**。

| 順 | 作業 | 担当 | 完了条件 |
|---|---|---|---|
| 0 | `docker compose up -d` / backend 起動 / `git checkout -b feature/job-queue` | ユーザー | 3プロセス起動 |
| 1 | schema に第2節を追記 → `npx prisma migrate dev --name add_job_queue` | **ユーザー**(5回目の同型作業) | migrate 成功、`tsc --noEmit` 通過 |
| 2 | `lib/queue.ts` を第4節どおりに実装 | **Opus が骨組み**、`claimNextJob` の手順3〜4は**ユーザーが穴埋め**(排他の核心) | `tsc` 通過。`npx tsx` の一時スクリプトで enqueue → claim → complete を1周させ、DB の status 遷移を提示 |
| 3 | `worker.ts` を第5節どおりに実装、package.json に script 追加 | Opus | `npm run worker` で `[worker] started` が出て、2の残 Job を処理する |
| 4 | signup を第6節どおりに置換 | **ユーザー**(数行) | `tsc` 通過 |
| 5 | seed に `job.deleteMany()`、.env.example に `QUEUE_ORDER` | Opus | seed 実行成功 |
| 6 | 第8節の検証 V1〜V6 を実施し、**結果の数値を提示** | Opus(実行)+ ユーザー(観察) | 全件 PASS |
| 7 | コミット → PR(第10節のテンプレ) | ユーザー | — |

**Opus が守ること**:
- 各ステップで「何をしているか / なぜ必要か」を Rails 対比を交えて説明する(`Job` テーブル ≒ Solid Queue / Sidekiq の Redis、`worker.ts` ≒ `bin/jobs`)
- **コミット・push は行わない**(ユーザーが実行)
- `lib/mail.ts` / `docker-compose.yml` / frontend を触らない
- 型は `any` 禁止。`payload` の受け渡しは `JobPayloads[T]` で型付けする
- 検証結果は「コマンド → 出力」を省略せず提示する(ステータスコード・秒数・ログ行)

---

## 8. 検証手順と期待結果(Fable のチェック基準)

前提: `test@example.com` は seed 済み。signup には毎回別のメールアドレスを使う(`q1@example.com`, `q2@…`)。
検証後は `npx prisma db seed` と `curl -X DELETE http://localhost:8025/api/v1/messages` で掃除。

### V1: レスポンス時間(3-1 との比較)— 最重要

```bash
docker compose pause mailpit              # 3-1 と同じ「SMTP 無応答」条件
curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" \
  -X POST http://localhost:8787/api/auth/signup \
  -H "Content-Type: application/json" -d '{"email":"q1@example.com","password":"password123"}'
docker compose unpause mailpit
```

| 期待 | 根拠 |
|---|---|
| **HTTP 201、1.0s 未満**(scrypt の ~0.3s のみ) | 3-1 では同条件で **30.37s**。メール送信がレスポンス経路から外れた証拠 |

### V2: 正常系(Job が完了しメールが届く)

Worker 起動中に signup(`q2@…`)→ Worker ログに `claimed` → `completed`。Mailpit(http://localhost:8025)に1通。DB の Job が `completed` かつ `attempts = 1`。

### V3: リトライ → dead

```bash
docker compose stop mailpit               # ← pause ではなく stop(即 ECONNREFUSED で失敗するため短時間で観察できる)
# signup q3@… → Worker ログを観察
```

期待ログ(時刻はおよそ):

```
t+0s   claimed job#N attempt=1/3
t+0s   failed  job#N attempt=1/3 → retry in 5s
t+5s   claimed job#N attempt=2/3
t+5s   failed  job#N attempt=2/3 → retry in 10s
t+15s  claimed job#N attempt=3/3
t+15s  dead    job#N after 3 attempts
```

DB: `status = dead`, `attempts = 3`, `lastError` に ECONNREFUSED。

### V4: リトライ中に復旧すると成功する(Queue の価値)

`docker compose stop mailpit` → signup `q4@…` → 1回目失敗のログを見た**直後に** `docker compose start mailpit` → 2回目で `completed`、メールが届く。
**3-1 では失われていたメールが、Queue によって届く**ことの実証。

### V5: Worker を2つ起動しても二重処理しない(排他)

ターミナル2枚で `npm run worker` → signup を3件(`q5a`, `q5b`, `q5c`)。
期待: 各 job# の `claimed` ログが**どちらか一方の Worker にだけ**出る。Mailpit に**ちょうど3通**。DB の3件すべて `attempts = 1`。

### V6: Stack(LIFO)との比較

Worker を全部止める → signup を3件(`q6a`, `q6b`, `q6c`。job# は昇順に採番される)→
`QUEUE_ORDER=lifo npm run worker` → 処理順が **q6c → q6b → q6a**(job# 降順)になる。
続けて FIFO で同じことをやり **q → 昇順** を確認。

観察後に答えること: 「メール送信はなぜ FIFO であるべきか」「LIFO が向くのはどんな処理か(Undo、ブラウザの戻る、再帰の呼び出し履歴)」

### 静的チェック

`cd backend && npx tsc --noEmit` エラーなし。既存 API(lists / items / login)が壊れていないこと(`curl` で 200 を確認)。

---

## 9. スコープ外(意図的に実装しないもの)

| 項目 | 何が起きるか | 実務での対処(説明できるようにする) |
|---|---|---|
| **可視性タイムアウト** | Worker が Job 処理中にクラッシュすると、その Job は `processing` のまま**永遠に誰にも拾われない** | `startedAt` が N 分以上前の `processing` を pending に戻す回収処理。SQS の Visibility Timeout、BullMQ の stalled job 検知が同じ役割 |
| `SKIP LOCKED` | 楽観ロックだと負けた Worker は1秒無駄に待つ(正しさには影響しない) | `SELECT ... FOR UPDATE SKIP LOCKED` なら負けた側が即座に次の行を取れる |
| 完了 Job の掃除 | `completed` が溜まり続ける | 定期削除、または別テーブルへ退避 |
| 冪等性 | 同じメールが2回届く可能性はゼロではない(送信成功後・`completeJob` 前にクラッシュした場合) | Job に冪等キーを持たせ、送信側で重複を検知。**at-least-once 配送**という概念 |
| 優先度・遅延実行・スケジュール | — | `runAt` を未来にすれば遅延実行はそのまま作れる(今回は未使用) |

これらは **TASKS.md 3-5 の振り返りで「知っているが今回は作らなかった」として説明する**。

---

## 10. PR テンプレ(ユーザーが作成)

タイトル: `feat: メール送信をJobキュー化(PostgreSQL Jobテーブル + Worker)`

本文の必須項目: 概要 / 変更内容 / **設計判断**(楽観ロックの仕組み・SKIP LOCKED を使わなかった理由・リトライ回数と待ち時間の根拠・dead の扱い)/ **動作確認**(V1〜V6 の実測値)/ スコープ外(第9節)/ 参照した一次情報(第11節)

---

## 11. Fable レビューチェックリスト

実装完了後、Fable は以下を**現物を読んで**確認する。

**スキーマ**
- [ ] 第2節と一致(enum 4値、`@@index([status, runAt])`、`payload Json`)
- [ ] マイグレーションが1ファイルで、既存テーブルに影響がない

**queue.ts**
- [ ] `claimNextJob` が `updateMany` の `where` に **`status: pending` を含み**、`count === 0` で null を返す(ここが無いと V5 が通らない)
- [ ] `attempts` の増加が **claim 時のみ**(failJob で二重加算していない)
- [ ] `failJob` の分岐: `attempts >= maxAttempts` → dead、それ以外 → pending + runAt 加算
- [ ] `retryDelayMs(1) = 5000`, `retryDelayMs(2) = 10000`
- [ ] `payload` に `any` を使っていない

**worker.ts**
- [ ] `import "dotenv/config"` が1行目
- [ ] 空のとき sleep、あるとき連続処理
- [ ] SIGINT/SIGTERM で `running = false`(処理中の Job を途中で殺さない)
- [ ] unknown type → 即 dead
- [ ] ログ形式が第5節と一致

**signup**
- [ ] `sendVerificationEmail` の呼び出しと import が auth.ts から消えている
- [ ] `enqueue` が `createVerificationToken` の後に呼ばれている

**周辺**
- [ ] seed に `job.deleteMany()`、package.json に `worker` script、.env.example に `QUEUE_ORDER`
- [ ] `mail.ts` / `docker-compose.yml` / frontend に差分が**無い**
- [ ] `tsc --noEmit` クリーン

**検証**
- [ ] V1 の実測が **1.0s 未満**で、3-1 の 30.37s と並べて PR に記載されている
- [ ] V3 のログに `attempt=1/3 → 2/3 → 3/3 → dead` が揃っている
- [ ] V5 で Mailpit がちょうど3通、二重 claim のログが無い
- [ ] V6 で LIFO の処理順が降順

---

## 12. 参照した一次情報

- PostgreSQL 16 - SELECT / The Locking Clause: https://www.postgresql.org/docs/16/sql-select.html
  > "With SKIP LOCKED, any selected rows that cannot be immediately locked are skipped. … can be used to avoid lock contention with multiple consumers accessing a queue-like table."
- Prisma Client Reference - updateMany(戻り値 `BatchPayload { count: number }`): https://www.prisma.io/docs/orm/reference/prisma-client-reference#updatemany
- Prisma - Working with Json fields: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types/working-with-json-fields
- Node.js - process signal events(SIGINT / SIGTERM): https://nodejs.org/api/process.html#signal-events
