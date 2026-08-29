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
| Queue / Stack | 時間があれば。**まず概念理解**、できそうな範囲で実装もアリ。特定技術の指定なし | ⬜ 未着手 |
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
| 2-5 | 振り返り: Webアプリ → 送信処理 → SMTP/サービス → 受信 を説明する |

学習対象: SMTP とは何か / SMTPサーバーとは何か / メール送信ライブラリの役割 / SMTP認証 / FROM・TO / 送信失敗時の扱い / APIキー・SMTPパスワードの環境変数管理 / 開発環境でのメール確認方法

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

| Phase | 内容 |
|---|---|
| 3-1 | 同期/非同期の違いを、Priority 2 で作った実装を題材に理解する |
| 3-2 | Queue 技術の比較・選定(下記) |
| 3-3 | Queue に Job を積む / Worker が処理する、最小構成の実装 |
| 3-4 | リトライ・失敗時の扱い |
| 3-5 | 振り返り: HTTP Request → API → Queue → Worker → Job実行 を説明する |

学習対象: Queue / Job / Worker / Producer・Consumer / FIFO / 非同期処理 / バックグラウンド処理 / リトライ / Job失敗時の扱い / 重複実行 / 冪等性 / タイムアウト / Dead Letter Queue の概念 / メリット・デメリット

**すべてを最初から実装しない。まず基本構造を理解する。**

### Queue 技術の選定(3-2 で比較)

いきなり AWS SQS ありきで進めない。候補:

| 候補 | 概要 |
|---|---|
| アプリ内で概念だけ再現 | 外部依存ゼロ。Queue の考え方だけを最小コストで体験する |
| Redis(生) | 汎用KVS を Queue として使う。仕組みが見えやすい |
| BullMQ(Redis ベース) | Job/Worker/リトライ/DLQ が最初から揃う。Node の定番 |
| AWS SQS | 実務に最も近い。マネージドで DLQ・可視性タイムアウトが標準 |

比較の観点: 学習しやすさ / ローカル開発のしやすさ / **現在の Docker Compose との相性** / Next.js・Hono との相性 / 本番環境への発展性 / 実務での利用イメージ / インフラ構築コスト

## Priority 4: 外部API連携などの発展実装

**位置づけ: 発展候補。** 面談後チャットの「外部API連携等、自分なりに(AIと相談しながら)考えて
実装をしてみるのもアリ」を受けたもの。特定の外部APIが課題として指定されたわけではない。
Claude から案を出す場合は「何を実装するか / gear-list とどう関係するか / 何を学べるか / 実装量・難易度」を
先に提示し、**相談して決めてから実装する**。AWS SQS などのマネージド Queue も、Priority 3 の理解後の選択肢の一つ。
