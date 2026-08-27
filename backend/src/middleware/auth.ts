import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import { validateSession, type SessionUser } from "../lib/session.js";

// c.set / c.get でやり取りする値の型。
// この型を Hono の Env として渡すことで、c.get("user") の戻り値が
// SessionUser として推論され、キー名のタイプミスもコンパイルで検出できる
export type AuthEnv = {
  Variables: {
    user: SessionUser;
  };
};

// Cookie 名。routes/auth.ts の SESSION_COOKIE と一致させる必要がある
const SESSION_COOKIE = "session_id";

/**
 * 認証ミドルウェア。
 * Cookie のセッションIDからユーザーを特定し、後続のハンドラへ c.set で受け渡す。
 * 特定できない場合はハンドラを呼ばずに 401 を返す。
 *
 * ここで扱うのは Authentication(誰であるか)のみ。
 * 「そのリソースを操作してよいか」という Authorization は各ルート側の責務。
 */
export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const sessionId = getCookie(c, SESSION_COOKIE);

  // Cookie が無い = 一度もログインしていない、またはログアウト済み
  if (!sessionId) {
    return c.json({ error: "認証が必要です" }, 401);
  }

  // セッションが存在するか、期限内か、をサーバー側で検証する。
  // Cookie の値は利用者が自由に書き換えられるため、値の存在だけでは信用できない
  const user = await validateSession(sessionId);
  if (!user) {
    return c.json({ error: "認証が必要です" }, 401);
  }

  // 後続のハンドラへユーザーを渡す。
  // 各ルートは c.get("user") で受け取り、自分のデータだけを操作する条件に使う
  c.set("user", user);

  // next() を呼ばないとハンドラが実行されない。
  // 逆に、401 を返すときは next() を呼ばないことでリクエストをここで止めている
  await next();
});
