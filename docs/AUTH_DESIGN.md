# 認証設計の検討(Phase 2 / Priority 1)

作成: 2026-08-16
状態: **方式決定済み**(2026-08-16)

## 決定事項

| # | 論点 | 決定 |
|---|---|---|
| 1 | 認証方式 | **候補A: DBセッション + HttpOnly Cookie** |
| 2 | クロスオリジン対応 | **案1: `SameSite=None; Secure` + `credentials`** |
| 3 | 既存シードデータの扱い | **(a) 削除して seed し直す** |
| 4 | `User.name` | **持たせない**(email のみの最小構成。必要になれば後から追加) |
| 5 | セッションIDの長さ | **32バイト = 256ビット**(`crypto.randomBytes(32)`)。OWASP 最低ライン64ビットに対し十分な余裕 |
| 6 | セッション有効期限 | **30日**(学習用アプリのため。実務では用途に応じて30分〜2週間) |

比較の経緯と各候補の詳細は以下に残す。

---

## 1. 前提:現在の構成

```
ブラウザ ──画面要求──▶ Next.js (localhost:3000) ──fetch──▶ Hono (localhost:8787) ──Prisma──▶ PostgreSQL (5432)
   │                                                            ▲
   └────── 作成・更新・削除は直接 API を呼ぶ(CORS 設定済み)─────┘
```

- **読み取り**: Server Component がサーバー間通信で API を呼ぶ(CORS 不要)
- **書き込み**: Client Component がブラウザから API を直接呼ぶ(CORS 必要)
- 認証関連のコード・依存パッケージは **現時点で一切存在しない**
- Prisma のモデルは `GearList` / `GearItem` の2つのみ。`User` は存在しない

### ⚠️ 設計上の最大の論点:ポートが違う = 別オリジン

`localhost:3000` と `localhost:8787` はブラウザから見て**別オリジン**。
Cookie を使う認証では、これが以下に影響する:

- Cookie の `SameSite` 属性(`Lax` だとクロスオリジンのリクエストに Cookie が乗らない)
- `fetch` 側の `credentials: "include"` 指定
- CORS 側の `credentials: true` 指定

**この問題への対処が、方式選定と同じくらい重要。** 後述の「4. オリジン問題への対処」を参照。

---

## 2. 認証方式の候補

### 候補A: DBセッション + HttpOnly Cookie

**仕組み**

```
1. ログイン: email + password を送る
2. サーバー: パスワードを検証 → セッションIDを乱数生成 → Session テーブルに保存
3. サーバー: Set-Cookie: session_id=<乱数>; HttpOnly; Secure; SameSite=...
4. 以降のリクエスト: ブラウザが自動で Cookie を送る
5. サーバー: Cookie の ID で Session テーブルを引く → User を特定
6. ログアウト: Session レコードを削除 + Cookie を削除
```

| 観点 | 評価 |
|---|---|
| メリット | **即時失効できる**(ログアウト・強制ログアウトが本当に効く)。仕組みが素直で全部見える。Cookie/Session の本質を学べる |
| デメリット | リクエストごとに DB 照会が1回増える。水平スケール時は工夫が要る(今回は無関係) |
| セキュリティ | `HttpOnly` で XSS からセッションを守れる。セッション固定化はログイン後の ID 再生成で対策 |
| このアプリとの相性 | ◎ Prisma に `Session` テーブルを足すだけ。既存構成を壊さない |
| 学習教材として | **◎ 最良**。ブラックボックスがない。Rails の `session` と対比できる |
| 実務での利用 | 自社サービスでは今も主流 |

**必要な実装**: Hono の Cookie ヘルパー(`hono/cookie` の `setCookie` / `getCookie` / `deleteCookie`)。追加ライブラリはパスワードハッシュのみ。

### 候補B: JWT + Authorization ヘッダ(localStorage 保存)

**仕組み**: ログイン時に JWT を発行 → フロントが localStorage に保存 → 毎回 `Authorization: Bearer <token>` で送る

| 観点 | 評価 |
|---|---|
| メリット | ステートレス(DB照会不要)。Hono に組み込み middleware(`hono/jwt`)がある |
| デメリット | **失効できない**(ログアウトは「クライアントが捨てるだけ」でトークン自体は有効なまま)。**localStorage は XSS で盗まれる** |
| セキュリティ | ✕ JS から読める場所にトークンを置くのは OWASP 的に非推奨寄り |
| このアプリとの相性 | △ クロスオリジン問題は起きない(Cookie を使わないため)が、セキュリティを犠牲にしている |
| 学習教材として | ○ JWT の構造(header.payload.signature)は学べる |
| 実務での利用 | SPA + 外部APIで使われるが、Cookie 方式に回帰する流れもある |

### 候補C: JWT + HttpOnly Cookie

**仕組み**: JWT を発行し、localStorage ではなく HttpOnly Cookie に入れる。Hono の `jwt()` middleware は `cookie` オプションで Cookie から読める。

| 観点 | 評価 |
|---|---|
| メリット | XSS 耐性あり(候補Bの弱点を解消)。DB照会不要 |
| デメリット | **失効できない問題は残る**。緩和するには「短命アクセストークン + リフレッシュトークン(DB保存)」が必要 → 結局 DB を引くので候補Aとの差が消え、複雑さだけ増える |
| セキュリティ | ○(ただし失効不可の設計リスクは残る) |
| このアプリとの相性 | △ クロスオリジン問題は候補Aと同じ。複雑さが上乗せ |
| 学習教材として | △ JWT とセッションの両方の概念が混ざり、初学時は混乱しやすい |

### 候補D: Next.js を BFF にする + セッション

**仕組み**: ブラウザは Next.js とだけ Cookie でやり取りし、Next.js がサーバー間通信で Hono を呼ぶ。

```
ブラウザ ──Cookie(同一オリジン)──▶ Next.js ──内部トークン──▶ Hono
```

| 観点 | 評価 |
|---|---|
| メリット | **クロスオリジン問題が消える**(`SameSite=Lax/Strict` が使える)。トークンをブラウザに一切出さない |
| デメリット | 経路が2段になり、Hono 側の認証を別途設計する必要がある。現在の「書き込みはブラウザから直接 Hono」という構成を作り変えることになる |
| このアプリとの相性 | △ 既存のフロント構成の変更が大きい |
| 学習教材として | ○ ただし **Ai-meshi で既に経験済みの構成**のため、新規の学習効果は相対的に低い |
| 実務での利用 | ◎ 認証情報を厳格に扱う場合の定石 |

### 候補E: 認証ライブラリを導入(Auth.js / Better Auth 等)

| 観点 | 評価 |
|---|---|
| メリット | 実装量が少ない。本番品質の実装が最初から手に入る |
| デメリット | **中身がブラックボックスになる** |
| 学習教材として | ✕ 今回の目的(仕組みを理解する)と正面から衝突する |
| 実務での利用 | ◎ ただし「中身を理解したうえで使う」のが前提 |

---

## 3. 推奨:候補A(DBセッション + HttpOnly Cookie)

### 理由

1. **学習目的に最も合う** — Cookie が何か、セッションが何か、ログイン状態の維持とは何か、が全部コードとして見える。ブラックボックスがない
2. **ログアウトが本当に機能する** — JWT では「クライアントがトークンを捨てるだけ」。DBセッションなら本当に無効化できる。この差を体験することが Token と Session の違いの理解に直結する
3. **既習知識が活きる** — Rails の `session` と同じ発想。「Rails でいうと〜」で説明できる
4. **既存構成を壊さない** — Prisma に `User` / `Session` を追加するだけ。ルーティング・ディレクトリ構成・Docker 構成の変更は不要
5. **追加ライブラリが最小** — Cookie 操作は Hono 標準。追加するのはパスワードハッシュ用の1つだけ
6. **実務でも通用する** — 自社サービスでは今も主流の方式

### この方式で学べること(Phase 2 の目的との対応)

| 目的 | どこで学ぶか |
|---|---|
| Authentication と Authorization の違い | ログイン処理(認証)と所有者チェック(認可)を別の層として実装する |
| ログイン状態をどう維持するか | Cookie がリクエストごとに自動送信される仕組みを実際に観察する |
| Cookie / Session / Token の違い | Cookie(運び手)と Session(サーバー側の状態)を分けて実装することで区別が体感できる |
| パスワードを安全に扱う | ハッシュ化・salt・平文を保存しない理由 |

---

## 4. オリジン問題への対処(方式Aを選ぶ場合、要決定)

`localhost:3000` → `localhost:8787` は別オリジンのため、素直に実装すると Cookie が送られない。対処案は2つ。

### 案1: SameSite=None + credentials を有効化

```
Cookie:  SameSite=None; Secure; HttpOnly
fetch:   credentials: "include"
CORS:    credentials: true(origin のワイルドカード不可、現状は既に限定済みなので問題なし)
```

- ○ 現在の構成をそのまま維持できる
- △ `SameSite=None` は CSRF に対する防御力が下がる(ただし JSON API + CORS 限定で実質的に防御される)
- 補足: `Secure` 属性は HTTPS 必須だが、**`localhost` はブラウザが安全なオリジンとして扱う**ため開発環境で動作する

### 案2: Next.js の rewrites で API をプロキシし、同一オリジンにする

```
ブラウザ → localhost:3000/api/... → (Next.jsが転送) → localhost:8787/api/...
```

- ○ 同一オリジンになるので `SameSite=Lax` が使え、CORS も不要になる
- △ Next.js の設定追加が必要。実際の通信経路が1段増えて見えにくくなる

**推奨は案1**(現在の構成と「ブラウザ → Hono 直通」という設計思想を維持でき、CORS の学習内容もそのまま活きるため)。ただし案2も合理的なので相談のうえ決定する。

---

## 5. パスワードハッシュの選定(要決定)

OWASP Password Storage Cheat Sheet の推奨(2026-08-16 時点で確認):

| 優先 | アルゴリズム | 推奨パラメータ |
|---|---|---|
| 1 | **Argon2id** | メモリ 19MiB 以上 / 反復 2 / 並列度 1 |
| 2 | scrypt | CPU/メモリコスト 2^17 以上 / ブロックサイズ 8 / 並列度 1 |
| 3 | bcrypt(レガシー扱い) | ワークファクタ 10 以上、**パスワード長 72バイト上限に注意** |

> salt について: 「モダンなライブラリは salt を自動生成する」。**自前で salt を実装しない。**

Node.js には `crypto.scrypt` が標準搭載されているため、**追加ライブラリなしで候補2(scrypt)を実装する選択肢もある**。
Argon2id を使う場合は `@node-rs/argon2` などの追加が必要。
学習効果(ハッシュ・saltの仕組みが見える)と依存の少なさを踏まえ、実装フェーズで相談して決定する。

---

## 6. 採用した場合の変更範囲(概要)

### Database(Prisma schema)

```prisma
model User {
  id           Int        @id @default(autoincrement())
  email        String     @unique
  passwordHash String                    // 平文は絶対に保存しない
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  gearLists    GearList[]
  sessions     Session[]
}

model Session {
  id        String   @id            // 推測不能な乱数(64bit以上のエントロピー)
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

// 既存 GearList に追加
model GearList {
  // ... 既存フィールド
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId Int                        // ← 既存データの扱いを要検討(下記)
}
```

**要検討**: 既存の GearList(シードの夏山・冬山)には `userId` が無い。マイグレーション時の選択肢は
(a) 既存データを削除して seed し直す / (b) デフォルトユーザーを作って紐付ける / (c) 一旦 nullable にする。
開発環境のみでデータの価値が低いため **(a) が最も簡単**だが、実装フェーズで相談する。

### Backend(Hono)

| ファイル | 変更 |
|---|---|
| `src/schemas/auth.ts` | 新規。signup / login の Zod スキーマ |
| `src/routes/auth.ts` | 新規。signup / login / logout / me |
| `src/lib/password.ts` | 新規。ハッシュ化と検証 |
| `src/lib/session.ts` | 新規。セッションの発行・検証・破棄 |
| `src/middleware/auth.ts` | 新規。Cookie からユーザーを特定し `c.set("user", ...)`。未ログインは 401 |
| `src/routes/lists.ts` | **変更**。全エンドポイントに認証 middleware、クエリに `where: { userId }` を追加、所有者チェック |
| `src/routes/items.ts` | **変更**。親リストの所有者チェックを追加 |
| `src/index.ts` | **変更**。`/api/auth` のマウント、CORS に `credentials: true` |
| `.env` / `.env.example` | **変更**。セッション関連の秘密鍵を追加 |

### Frontend(Next.js)

| ファイル | 変更 |
|---|---|
| `app/signup/page.tsx` / `app/login/page.tsx` | 新規 |
| `components/SignupForm.tsx` / `LoginForm.tsx` / `LogoutButton.tsx` | 新規 |
| `lib/api.ts` | **変更**。全 fetch に `credentials: "include"`、認証系関数の追加、401 のハンドリング |
| `types/gear.ts` | **変更**。`User` 型の追加、`GearList` に `userId` |
| `app/page.tsx` / `app/lists/[id]/page.tsx` | **変更**。未ログイン時のリダイレクト |
| `app/layout.tsx` | **変更**(可能性)。ログイン状態の表示 |

> Server Component からの fetch は「サーバー間通信」のため、**ブラウザの Cookie が自動では乗らない**。
> Server Component で認証状態を扱う方法(Cookie を明示的に転送する等)は、実装フェーズで扱う論点。

---

## 6-2. 実装仕様(確定版・この通りに実装する)

以下は決定事項に基づく**実装レベルの仕様**。実装時はこの節を正とし、逸脱する場合は先に理由を説明して合意を取る。

### スキーマ(最終形)

```prisma
model User {
  id           Int        @id @default(autoincrement())
  email        String     @unique
  passwordHash String
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  gearLists    GearList[]
  sessions     Session[]
}

model Session {
  id        String   @id
  userId    Int
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  @@index([userId])
}

model GearList {
  // 既存フィールドは変更なし
  user   User @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId Int
  @@index([userId])
}
// GearItem は変更しない(所有者は親 GearList 経由で判定)
```

### パスワードハッシュ: **scrypt(Node.js 標準)**

- `crypto.scrypt` を使用。追加ライブラリなし
- salt: `crypto.randomBytes(16)` で毎回生成
- 保存形式: `scrypt$<salt hex>$<hash hex>`(将来アルゴリズムを変えられるようプレフィックスを付ける)
- 比較: `crypto.timingSafeEqual`(タイミング攻撃対策。`===` で比較しない)
- 配置: `backend/src/lib/password.ts` に `hashPassword` / `verifyPassword`

### セッション

- ID: `crypto.randomBytes(32).toString("hex")`(64文字)
- 有効期限: 発行から30日。`expiresAt` を DB に保存
- 検証時: Cookie の ID で `Session` を引き、`expiresAt > now` かつ user が存在すれば有効
- ログイン成功時: **既存の Cookie があっても新しいセッションを発行**(セッション固定化対策)
- ログアウト時: `Session` レコード削除 + Cookie 削除
- 配置: `backend/src/lib/session.ts` に `createSession` / `validateSession` / `deleteSession`

### Cookie(Hono の `hono/cookie` を使用)

```ts
setCookie(c, "session_id", sessionId, {
  httpOnly: true,
  secure: true,       // localhost はブラウザが安全なオリジンとして扱うため開発環境でも動く
  sameSite: "None",   // 3000 → 8787 のクロスオリジンで Cookie を送るため
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
});
```

### CORS(`backend/src/index.ts` の変更)

```ts
cors({ origin: "http://localhost:3000", credentials: true })
```

### フロントの fetch(`frontend/lib/api.ts` の変更)

- **全ての fetch に `credentials: "include"`** を付ける(これが無いと Cookie が送られない)
- Server Component からの fetch は、ブラウザの Cookie が自動では乗らない。`next/headers` の `cookies()` で取り出し、`Cookie` ヘッダとして明示的に転送する

### API 仕様

| メソッド | パス | ボディ | 成功 | 異常 |
|---|---|---|---|---|
| POST | `/api/auth/signup` | `{ email, password }` | 201 + Cookie 発行 | 400(検証)/ 409(email 重複) |
| POST | `/api/auth/login` | `{ email, password }` | 200 + Cookie 発行 | 400 / **401(email不在もパスワード違いも同じメッセージ)** |
| POST | `/api/auth/logout` | なし | 204 + Cookie 削除 | — |
| GET | `/api/auth/me` | なし | 200 `{ id, email }` | 401 |

- パスワード要件: 8文字以上(Zod の `.min(8)`)。上限は 72 ではなく余裕を持って 128
- ログイン失敗時のメッセージは「メールアドレスまたはパスワードが正しくありません」で統一(ユーザー列挙防止)
- レスポンスに `passwordHash` を **絶対に含めない**(Prisma の `select` で明示的に除外)

### 認証 Middleware(`backend/src/middleware/auth.ts`)

- Cookie から `session_id` を取得 → `validateSession` → 有効なら `c.set("user", { id, email })` → `next()`
- 無効・不在なら **401** `{ error: "認証が必要です" }`
- 型安全のため Hono の `Variables` 型で `user` を宣言する

### 認可(所有者チェック)

- lists 系: `where: { id, userId: user.id }` で引く。**見つからなければ 404**(403 ではない。他人のリストの存在自体を漏らさないため)
- items 系: 親 GearList を `where: { id: listId, userId: user.id }` で確認してから操作。同じく不在は 404
- `GET /api/lists` は `where: { userId: user.id }` で自分のリストのみ返す

### seed の変更

- テスト用ユーザーを1名作成: `test@example.com` / `password123`(README に開発専用と明記)
- 夏山・冬山リストはそのユーザーの `userId` で作成
- 冪等性維持: 先頭で `user.deleteMany()`(Cascade で GearList / Session も消える)

### 実装順序(1PR = 1ステップ)

| PR | 内容 | ブランチ名 |
|---|---|---|
| A | schema 変更 + migrate + password.ts + seed 修正 | `feature/auth-schema` |
| B | session.ts + auth ルート(signup/login/logout/me)+ index.ts のマウント・CORS | `feature/auth-api` |
| C | 認証 middleware + lists/items への適用 + 認可 | `feature/auth-guard` |
| D | フロント(api.ts の credentials、登録・ログイン画面、リダイレクト) | `feature/auth-frontend` |
| E | セキュリティ検証(他ユーザーアクセス)+ 振り返り | `docs/auth-review` |

## 7. 参照した一次情報

- Hono - Cookie Helper: https://hono.dev/docs/helpers/cookie
- Hono - JWT Middleware: https://hono.dev/docs/middleware/builtin/jwt
- Hono - CSRF Protection: https://hono.dev/docs/middleware/builtin/csrf
- OWASP - Password Storage Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
- OWASP - Session Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html
