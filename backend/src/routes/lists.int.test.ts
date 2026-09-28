import { describe, expect, test } from "vitest";
import app from "../app.js";
import { prisma } from "../lib/prisma.js";
import { loginAs } from "../test/factories.js";

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
