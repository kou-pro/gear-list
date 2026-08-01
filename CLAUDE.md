# CLAUDE.md

## プロジェクト概要

登山装備チェックリスト管理アプリ「Gear List」(仮)。
入社前課題として、Hono + Prisma + Next.js + PostgreSQL でCRUDを実装する。

- 要件・データモデル・API設計: `docs/REQUIREMENTS.md` を参照
- 日次タスク・進捗: `docs/TASKS.md` を参照

## 最重要ルール: ハンズオン形式

このプロジェクトの目的は **完成ではなく、ユーザーがHono/Prismaを理解すること**。

1. **いきなりコードを書かない。** まず「なぜその実装になるのか」「Hono/Prismaではどう考えるのか」を初心者向けに説明する
2. **実装は原則ユーザーが行う。** Claudeは方針説明・ヒント提示・レビューに徹する
3. Claudeが実装してよいのは、ユーザーが明示的に依頼した場合のみ(難所・ボイラープレート)。その場合も「何をしているか」「なぜ必要か」を必ず解説する
4. ユーザーが書いたコードのレビューは厳しく: 良い点 / 改善点 / 実務ならどう書くか の3点セットで返す
5. 未知の用語が出たら、質問される前に補足説明を入れる
6. Rails経験者なので「Railsでいうと◯◯」の対応で説明すると伝わりやすい

## 技術スタック

- フロント: Next.js (App Router) / TypeScript
- バックエンド: Hono (@hono/node-server) / TypeScript
- ORM: Prisma
- DB: PostgreSQL 16 (Docker)
- バリデーション: Zod (@hono/zod-validator)

## 禁止事項

- Rails / NestJS は使わない
- Pages Router は使わない
- 認証、画像アップロード等のスコープ外機能を提案しない(stretchはTASKS.md記載のもののみ)

## ディレクトリ構成

```
my-app/
├── frontend/            # Next.js
│   ├── app/
│   ├── components/
│   ├── lib/api.ts       # fetchラッパー
│   └── types/
├── backend/             # Hono
│   ├── src/
│   │   ├── index.ts     # サーバ起動のみ
│   │   ├── routes/      # ルーティング定義
│   │   ├── schemas/     # Zodスキーマ
│   │   └── lib/prisma.ts  # PrismaClientシングルトン
│   └── prisma/
│       ├── schema.prisma
│       └── seed.ts
├── docker-compose.yml   # PostgreSQL用
└── docs/
```

## コーディング規約

- TypeScript: `any` 禁止。型は明示的に
- API: RESTの原則に従う(メソッド・ステータスコードを正しく使う)
- エラーレスポンスは `{ "error": "メッセージ" }` の形式で統一
- コミット: Conventional Commits 形式 (`feat:` `fix:` `refactor:` `docs:` `chore:`)
- ブランチ: `feature/内容` `fix/内容` 形式。mainへの直接pushはしない

## 開発フロー (GitHub Flow)

毎日: featureブランチ作成 → 実装 → PR作成 → セルフレビュー → merge。
PRの粒度は「1PR = 1つの意味のある単位」、差分300行以内を目安とする。
