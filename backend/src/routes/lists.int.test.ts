import { describe, expect, test } from "vitest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { createSession } from "../lib/session.js";

// テスト用のユーザーを DB に作り、そのユーザーでログインした状態の Cookie を返す。
// 本物のログイン API を通すとパスワードのハッシュ計算(約0.3秒)が毎回かかるため、
// セッションを直接発行して時間を短くする(ログイン API 自体のテストは別に書く)
async function loginAs(email: string): Promise<{ userId: number; cookie: string }> {
  const user = await prisma.user.create({
    data: { email, passwordHash: "テストでは照合しない" },
  });
  const session = await createSession(user.id);

  return { userId: user.id, cookie: `session_id=${session.id}` };
}

describe("GET /api/lists", () => {
  test("未ログインなら 401", async () => {
    const res = await app.request("/api/lists");

    expect(res.status).toBe(401);
  });

  test("自分のリストだけが返り、他人のリストは含まれない", async () => {
    const a = await loginAs("a@example.com");
    const b = await loginAs("b@example.com");
    await prisma.gearList.create({ data: { title: "Aの山行", userId: a.userId } });
    await prisma.gearList.create({ data: { title: "Bの山行", userId: b.userId } });

    const res = await app.request("/api/lists", {
      headers: { Cookie: a.cookie },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject([{ title: "Aの山行", userId: a.userId }]);
  });
});
