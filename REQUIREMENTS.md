# REQUIREMENTS.md — 要件定義書

## 1. アプリ概要

登山の装備チェックリスト管理アプリ。

- 装備リスト(例:「夏山日帰り」「冬山テント泊」)を自由に作成・編集・削除できる
- 各リストに装備品を追加し、パッキング済みチェックを付けられる
- 初期状態で「夏山日帰り」「冬山日帰り」の2リストがシードデータとして投入されている
  (山岳救助経験に基づく実践的な内容にする)

## 2. データモデル

### GearList(装備リスト)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | Int | 主キー, autoincrement | |
| title | String | 必須 | リスト名(例: 沢登り) |
| description | String? | 任意 | 説明(例: 7月の日帰り想定) |
| createdAt | DateTime | 自動設定 | |
| updatedAt | DateTime | 自動更新 | |

### GearItem(装備品)

| カラム | 型 | 制約 | 説明 |
|---|---|---|---|
| id | Int | 主キー, autoincrement | |
| name | String | 必須 | 装備名(例: ツェルト) |
| quantity | Int | 必須, デフォルト1 | 数量(例: ペグ×8) |
| checked | Boolean | 必須, デフォルトfalse | パッキング済みフラグ |
| gearListId | Int | 外部キー | 所属リスト |
| createdAt | DateTime | 自動設定 | |
| updatedAt | DateTime | 自動更新 | |

### リレーション

- GearList 1 対 多 GearItem
- **onDelete: Cascade**(リスト削除時、所属アイテムも削除。孤児レコードを残さないため)

### 設計判断の記録(レビュー時に説明できるように)

- checkedをGearItem本体に持たせた理由: 1対1のCheckテーブル分離は、履歴やユーザー別状態が不要な今回は過剰設計。JOINと存在確認のコストだけ増える
- quantityを持たせた理由: ペグ・ガス缶など複数個持つ装備を「名前×数」で汚さず表現するため

## 3. API設計 (Hono)

ベースURL: `http://localhost:8787/api`

### GearList

| メソッド | パス | 説明 | 成功時 |
|---|---|---|---|
| GET | /lists | リスト一覧取得 | 200 |
| GET | /lists/:id | リスト詳細(所属アイテム含む) | 200 |
| POST | /lists | リスト作成 | 201 |
| PATCH | /lists/:id | リスト更新(title, description) | 200 |
| DELETE | /lists/:id | リスト削除(アイテムも連動削除) | 204 |

### GearItem

| メソッド | パス | 説明 | 成功時 |
|---|---|---|---|
| POST | /lists/:listId/items | アイテム追加 | 201 |
| PATCH | /items/:id | アイテム更新(name, quantity, checked) | 200 |
| DELETE | /items/:id | アイテム削除 | 204 |

### エラーレスポンス

- 400: バリデーションエラー(Zodで検証)
- 404: 対象リソースが存在しない
- 形式: `{ "error": "メッセージ" }`

## 4. 画面構成 (Next.js App Router)

| パス | 画面 | 主な機能 |
|---|---|---|
| / | リスト一覧 | 一覧表示、新規作成、削除 |
| /lists/[id] | リスト詳細 | アイテム一覧、追加、チェック切替、削除、リスト編集 |

※ フロントは最低限。会社の指示は「フロントよりAPIを重点的に」。

## 5. シードデータ

- 「夏山日帰り」: レインウェア、ヘッドランプ、ファーストエイドキット、行動食、地図・コンパス など
- 「冬山日帰り」: 上記 + アイゼン、ピッケル、ビーコン、ツェルト、テルモス など

## 6. スコープ外(やらないこと)

- 認証・ユーザー管理
- 画像アップロード
- デプロイ(ローカル動作でOK)

## 7. Stretch(完成後のバッファ期間のみ着手可)

1. リスト複製API: `POST /lists/:id/duplicate`
2. 装備の合計重量: GearItemにweightカラム追加 + Prismaのaggregateで集計
3. UI改善
