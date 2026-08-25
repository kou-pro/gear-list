import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { prisma } from "../lib/prisma.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import {
  createSession,
  deleteSession,
  validateSession,
} from "../lib/session.js";
import { loginSchema, signupSchema } from "../schemas/auth.js";
import { validationHook } from "../lib/validation.js";
import { PrismaClientKnownRequestError } from "../generated/prisma/internal/prismaNamespace.js";

const app = new Hono();

// Cookie 名。フロントからは読まない(HttpOnly)ので、外に出す必要はない
const SESSION_COOKIE = "session_id";

// ログイン失敗時のメッセージは、原因を問わず必ずこの1文に統一する。
// 「そのメールアドレスは存在しません」と返すと、どのアドレスが登録済みかを
// 総当たりで調べられてしまう(ユーザー列挙攻撃)
const LOGIN_FAILED_MESSAGE = "メールアドレスまたはパスワードが正しくありません";

// ユーザーが存在しないときに verifyPassword へ渡すダミーの保存値。
// メッセージを統一しても、存在しない場合だけ scrypt を実行せず即座に返すと
// 応答時間が短くなり(23ms 対 314ms)、時間差でアカウントの有無が判別できてしまう。
// 実在するのと同じ形式の値を検証させることで、どちらの経路でも同じだけ時間をかける
const DUMMY_PASSWORD_HASH =
  "scrypt$00000000000000000000000000000000$" + "0".repeat(128);

// セッション Cookie を発行する。ログイン・登録の両方から使うので関数にまとめる
function setSessionCookie(c: Context, sessionId: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, sessionId, {
    // JavaScript から document.cookie で読めなくする。
    // XSS が起きてもセッションIDだけは盗まれない、という多層防御
    httpOnly: true,
    // HTTPS でのみ送信する。localhost はブラウザが安全なオリジンとして扱うため開発でも動く
    secure: true,
    // フロント(:3000)と API(:8787)はポートが違い別オリジンになる。
    // Lax だと「他サイトへのリクエスト」と判定されて Cookie が送られないため None にする。
    // CSRF 防御が弱まる分は、JSON 限定 + CORS の origin 限定でカバーしている
    sameSite: "None",
    path: "/",
    // Cookie 側の期限。サーバー側の expiresAt と揃える
    // (Cookie は改ざんできるため、実際の判定は必ずサーバー側の値で行う)
    maxAge: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
  });
}

// POST /signup — 実際のURLは POST /api/auth/signup
app.post(
  "/signup",
  zValidator("json", signupSchema, validationHook),
  async (c) => {
    const { email, password } = c.req.valid("json");

    try {
      const user = await prisma.user.create({
        data: {
          email,
          // 平文は保存しない。必ずハッシュ化してから渡す
          passwordHash: await hashPassword(password),
        },
      });

      // 登録が終わったらそのままログイン状態にする(都度ログインさせない)
      const session = await createSession(user.id);
      setSessionCookie(c, session.id, session.expiresAt);

      // passwordHash は絶対に返さない。必要な項目だけを明示して返す
      return c.json({ id: user.id, email: user.email }, 201);
    } catch (err) {
      // email に @unique を付けているため、重複時は一意制約違反 P2002 が飛ぶ
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return c.json({ error: "このメールアドレスは既に登録されています" }, 409);
      }
      throw err;
    }
  },
);

// POST /login — 実際のURLは POST /api/auth/login
app.post("/login", zValidator("json", loginSchema, validationHook), async (c) => {
  const { email, password } = c.req.valid("json");

  const user = await prisma.user.findUnique({ where: { email } });

  // ユーザーが存在しなくても検証処理自体は必ず実行する。
  // ここで早期 return すると scrypt の計算(約290ms)がスキップされ、
  // 応答時間の差からアカウントの有無が判別できてしまうため
  const isValid = await verifyPassword(
    password,
    user?.passwordHash ?? DUMMY_PASSWORD_HASH,
  );

  // ユーザーが存在しない場合も、パスワードが違う場合も、同じ 401 と同じ文面を返す。
  // 判定を1箇所にまとめることで、片方だけ処理が漏れる事故も防いでいる
  if (!user || !isValid) {
    return c.json({ error: LOGIN_FAILED_MESSAGE }, 401);
  }

  // ログインのたびに新しいセッションを発行する。
  // 既存のセッションIDを再利用すると、攻撃者が事前に用意したIDを
  // 被害者にログインさせて乗っ取る「セッション固定化攻撃」が成立してしまう
  const session = await createSession(user.id);
  setSessionCookie(c, session.id, session.expiresAt);

  return c.json({ id: user.id, email: user.email });
});

// POST /logout — 実際のURLは POST /api/auth/logout
app.post("/logout", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);

  if (sessionId) {
    // サーバー側のセッションを破棄する。
    // Cookie を消すだけでは、同じIDを手元に控えた攻撃者が使い続けられてしまう
    await deleteSession(sessionId);
  }

  deleteCookie(c, SESSION_COOKIE, { path: "/" });

  // 未ログイン状態で呼ばれても 204 を返す。
  // 「ログアウトしたい」という意図は既に満たされているため、エラーにする理由がない
  return c.body(null, 204);
});

// GET /me — 実際のURLは GET /api/auth/me
// フロントが「今ログインしているか」を確認するために使う
app.get("/me", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);

  if (!sessionId) {
    return c.json({ error: "認証が必要です" }, 401);
  }

  const user = await validateSession(sessionId);
  if (!user) {
    return c.json({ error: "認証が必要です" }, 401);
  }

  return c.json(user);
});

export default app;
