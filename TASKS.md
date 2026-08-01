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
