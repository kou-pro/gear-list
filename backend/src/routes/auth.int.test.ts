import { beforeEach, describe, expect, test } from "vitest";
import { verifyPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { createVerificationToken } from "../lib/verification.js";
import { createUserWithPassword, loginAs } from "../test/factories.js";
import { send, sessionIdFrom } from "../test/request.js";

// auth.ts の LOGIN_FAILED_MESSAGE と同じ文面。
// 「メールが無い」と「パスワードが違う」を区別しないための統一メッセージ
const LOGIN_FAILED = { error: "メールアドレスまたはパスワードが正しくありません" };

// ---------------------------------------------------------------------------
// サインアップ(AU-01〜10)
// ---------------------------------------------------------------------------
describe("POST /api/auth/signup", () => {
  test("登録できて 201。レスポンスは id と email だけで、passwordHash を含まない", async () => {
    const res = await send("POST", "/api/auth/signup", undefined, {
      email: "a@example.com",
      password: "password123",
    });

    expect(res.status).toBe(201);
    // toEqual は余計なキーがあると失敗するので、passwordHash が混ざっていないことも確かめられる
    expect(await res.json()).toEqual({ id: expect.any(Number), email: "a@example.com" });
  });

  test("DB にはハッシュ化したパスワードが保存され、平文は保存されない", async () => {
    await send("POST", "/api/auth/signup", undefined, {
      email: "a@example.com",
      password: "password123",
    });

    const user = await prisma.user.findUnique({ where: { email: "a@example.com" } });
    expect(user?.passwordHash).toMatch(/^scrypt\$/);
    expect(user?.passwordHash).not.toContain("password123");
    expect(await verifyPassword("password123", user?.passwordHash ?? "")).toBe(true);
  });

  test("登録と同時にログイン状態になる(安全な属性付きの Cookie が発行される)", async () => {
    const res = await send("POST", "/api/auth/signup", undefined, {
      email: "a@example.com",
      password: "password123",
    });

    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=None");

    const me = await send("GET", "/api/auth/me", `session_id=${sessionIdFrom(res)}`);
    expect(me.status).toBe(200);
    expect(await me.json()).toMatchObject({ email: "a@example.com", emailVerified: false });
  });

  test("確認トークンが作られ、メール送信の Job がキューに積まれる", async () => {
    await send("POST", "/api/auth/signup", undefined, {
      email: "a@example.com",
      password: "password123",
    });

    const tokens = await prisma.verificationToken.findMany();
    expect(tokens).toHaveLength(1);
    const jobs = await prisma.job.findMany();
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      type: "send_verification_email",
      status: "pending",
      payload: { to: "a@example.com", token: tokens[0].id },
    });
  });

  test("同じメールアドレスで2回登録すると 409 で、ユーザーも Job も増えない", async () => {
    const body = { email: "a@example.com", password: "password123" };
    await send("POST", "/api/auth/signup", undefined, body);

    const res = await send("POST", "/api/auth/signup", undefined, body);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "このメールアドレスは既に登録されています" });
    expect(await prisma.user.count()).toBe(1);
    expect(await prisma.job.count()).toBe(1);
  });

  test("前後に空白があるメールは trim され、同じアドレスの重複として 409 になる", async () => {
    await send("POST", "/api/auth/signup", undefined, {
      email: "a@example.com",
      password: "password123",
    });

    const res = await send("POST", "/api/auth/signup", undefined, {
      email: "  a@example.com  ",
      password: "password123",
    });

    expect(res.status).toBe(409);
  });

  // パスワード長の境界値(有効範囲 8〜128 文字)
  test.each([
    { label: "7文字(下限-1)", length: 7, status: 400 },
    { label: "8文字(下限)", length: 8, status: 201 },
    { label: "128文字(上限)", length: 128, status: 201 },
    { label: "129文字(上限+1)", length: 129, status: 400 },
  ])("パスワード $label → $status", async ({ length, status }) => {
    const res = await send("POST", "/api/auth/signup", undefined, {
      email: "a@example.com",
      password: "a".repeat(length),
    });

    expect(res.status).toBe(status);
    // 400 のときはユーザーが作られていない
    expect(await prisma.user.count()).toBe(status === 201 ? 1 : 0);
  });
});

// ---------------------------------------------------------------------------
// ログイン(AU-11〜14)
// ---------------------------------------------------------------------------
describe("POST /api/auth/login", () => {
  let userId: number;

  beforeEach(async () => {
    ({ userId } = await createUserWithPassword("user@example.com", "correct-password"));
  });

  test("正しいパスワードなら 200 で、セッションが発行される", async () => {
    const res = await send("POST", "/api/auth/login", undefined, {
      email: "user@example.com",
      password: "correct-password",
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: userId, email: "user@example.com" });
    const setCookie = res.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("Secure");
    expect(setCookie).toContain("SameSite=None");
    expect(await prisma.session.count({ where: { userId } })).toBe(1);
  });

  test("1文字だけ違うパスワードなら 401 で、セッションは発行されない", async () => {
    const res = await send("POST", "/api/auth/login", undefined, {
      email: "user@example.com",
      password: "correct-passworD",
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual(LOGIN_FAILED);
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(await prisma.session.count()).toBe(0);
  });

  test("未登録のメールは、パスワード違いとまったく同じレスポンスになる(ユーザー列挙対策)", async () => {
    const wrongPassword = await send("POST", "/api/auth/login", undefined, {
      email: "user@example.com",
      password: "correct-passworD",
    });
    const unknownEmail = await send("POST", "/api/auth/login", undefined, {
      email: "nobody@example.com",
      password: "correct-password",
    });

    expect(unknownEmail.status).toBe(wrongPassword.status);
    expect(await unknownEmail.json()).toEqual(await wrongPassword.json());
  });

  test("ログインのたびに新しいセッション ID が発行される(セッション固定化対策)", async () => {
    const body = { email: "user@example.com", password: "correct-password" };
    const first = await send("POST", "/api/auth/login", undefined, body);
    const second = await send("POST", "/api/auth/login", undefined, body);

    expect(sessionIdFrom(first)).not.toBeNull();
    expect(sessionIdFrom(second)).not.toBe(sessionIdFrom(first));
    expect(await prisma.session.count({ where: { userId } })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// ログアウト(AU-15〜17)
// ---------------------------------------------------------------------------
describe("POST /api/auth/logout", () => {
  test("ログアウトすると、サーバー側のセッションも消え、同じ Cookie は使えなくなる", async () => {
    const { cookie } = await loginAs("a@example.com");

    const res = await send("POST", "/api/auth/logout", cookie);

    expect(res.status).toBe(204);
    // ブラウザ側の Cookie を消す指示(値が空・有効期限0)も返っている
    expect(sessionIdFrom(res)).toBe("");
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0");
    // Cookie を手元に控えておいて再利用しても、サーバー側で無効になっている
    expect(await prisma.session.count()).toBe(0);
    const after = await send("GET", "/api/lists", cookie);
    expect(after.status).toBe(401);
  });

  test("未ログインでログアウトしても 204(エラーにしない)", async () => {
    const res = await send("POST", "/api/auth/logout");

    expect(res.status).toBe(204);
  });

  test("消えるのはそのセッションだけで、別の端末のセッションは使える", async () => {
    const { userId, cookie: pc } = await loginAs("a@example.com");
    const phone = await prisma.session.create({
      data: { id: "phone-session", userId, expiresAt: new Date(Date.now() + 60_000) },
    });

    await send("POST", "/api/auth/logout", pc);

    const res = await send("GET", "/api/lists", `session_id=${phone.id}`);
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// ログイン中のユーザー情報(AU-18〜19)。期限切れは authorization.int.test.ts で確認済み
// ---------------------------------------------------------------------------
describe("GET /api/auth/me", () => {
  test("ログイン中なら 200 で、ユーザー情報を返す(passwordHash は含まない)", async () => {
    const { userId, cookie } = await loginAs("a@example.com");

    const res = await send("GET", "/api/auth/me", cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: userId, email: "a@example.com", emailVerified: false });
  });

  test("Cookie が無ければ 401", async () => {
    const res = await send("GET", "/api/auth/me");

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// メールアドレス確認(AU-20〜25)。トークンの状態遷移:
//   未使用 --確認--> 使用済み(行を削除) / 期限切れ --確認--> 失敗(行を削除)
// ---------------------------------------------------------------------------
describe("POST /api/auth/verify-email", () => {
  let userId: number;

  beforeEach(async () => {
    ({ userId } = await loginAs("a@example.com"));
  });

  test("未使用のトークンなら確認済みになり、トークンは消える", async () => {
    const token = await createVerificationToken(userId);

    const res = await send("POST", "/api/auth/verify-email", undefined, { token });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ verified: true });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.emailVerifiedAt).not.toBeNull();
    expect(await prisma.verificationToken.findUnique({ where: { id: token } })).toBeNull();
  });

  test("使用済みのトークンをもう一度使うと 400", async () => {
    const token = await createVerificationToken(userId);
    await send("POST", "/api/auth/verify-email", undefined, { token });

    const res = await send("POST", "/api/auth/verify-email", undefined, { token });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "リンクが無効か、期限切れです" });
  });

  test("期限切れのトークンは 400 で、確認済みにならず、トークンは消える", async () => {
    await prisma.verificationToken.create({
      data: { id: "expired-token", userId, expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await send("POST", "/api/auth/verify-email", undefined, { token: "expired-token" });

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "リンクが無効か、期限切れです" });
    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user?.emailVerifiedAt).toBeNull();
    expect(await prisma.verificationToken.findUnique({ where: { id: "expired-token" } })).toBeNull();
  });

  test.each([
    { label: "token キーが無い", body: {} },
    { label: "空文字", body: { token: "" } },
    { label: "文字列でない(数値)", body: { token: 123 } },
  ])("トークンの形が不正($label)なら 400", async ({ body }) => {
    const res = await send("POST", "/api/auth/verify-email", undefined, body);

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "トークンが指定されていません" });
  });
});
