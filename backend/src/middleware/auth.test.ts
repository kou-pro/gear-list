import { Hono } from "hono";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { requireAuth, type AuthEnv } from "./auth.js";
import { validateSession } from "../lib/session.js";

// session.js を偽物に差し替える。本物の validateSession は DB を読みに行くが、
// ここで確かめたいのは「ミドルウェアが結果に応じて正しく振り分けるか」だけなので、
// DB の結果は偽物で自由に作る
vi.mock("../lib/session.js", () => ({
  validateSession: vi.fn(),
}));

// テスト専用の小さなアプリ。本物のルートは使わず、ミドルウェアだけを検証する
const app = new Hono<AuthEnv>();
app.use("*", requireAuth);
app.get("/me", (c) => c.json(c.get("user")));

describe("requireAuth", () => {
  beforeEach(() => {
    // 前のテストで設定した戻り値や呼び出し回数を毎回リセットする
    vi.mocked(validateSession).mockReset();
  });

  test("Cookie なし → 401 で、セッション検証は呼ばれない", async () => {
    const res = await app.request("/me");

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "認証が必要です" });
    expect(validateSession).not.toHaveBeenCalled();
  });

  test("Cookie あり・セッション無効 → 401", async () => {
    vi.mocked(validateSession).mockResolvedValue(null);

    const res = await app.request("/me", {
      headers: { Cookie: "session_id=invalid" },
    });

    expect(res.status).toBe(401);
    expect(validateSession).toHaveBeenCalledWith("invalid");
  });

  test("Cookie あり・セッション有効 → 200 で、ハンドラにユーザーが渡る", async () => {
    const user = { id: 1, email: "a@example.com", emailVerified: true };
    vi.mocked(validateSession).mockResolvedValue(user);

    const res = await app.request("/me", {
      headers: { Cookie: "session_id=valid" },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(user);
    expect(validateSession).toHaveBeenCalledTimes(1);
  });
});
