import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "../lib/prisma.js";
import { createUserWithList, type Fixture } from "../test/factories.js";
import { send } from "../test/request.js";

// DB に無い ID。入力検証(1〜2147483647)は通るが、該当するレコードは無い
const MISSING_ID = 2147483647;

let a: Fixture;
let b: Fixture;

// 各テストの直前に A と B を作り直す(setup.ts の片付けの後に実行される)
beforeEach(async () => {
  a = await createUserWithList("a@example.com");
  b = await createUserWithList("b@example.com");
});

// ---------------------------------------------------------------------------
// デシジョンテーブル R1: 未ログイン → 401(S4-01〜06)
// ---------------------------------------------------------------------------
describe("未ログインはすべて 401", () => {
  // path を関数にしているのは、この表が beforeEach より先に読み込まれるため。
  // 読み込んだ時点ではまだ a が空なので、テスト実行時に ID を組み立てる
  test.each([
    { name: "GET /api/lists/:id", method: "GET", path: () => `/api/lists/${a.listId}` },
    { name: "PATCH /api/lists/:id", method: "PATCH", path: () => `/api/lists/${a.listId}` },
    { name: "DELETE /api/lists/:id", method: "DELETE", path: () => `/api/lists/${a.listId}` },
    { name: "POST /api/lists/:listId/items", method: "POST", path: () => `/api/lists/${a.listId}/items` },
    { name: "PATCH /api/items/:id", method: "PATCH", path: () => `/api/items/${a.itemId}` },
    { name: "DELETE /api/items/:id", method: "DELETE", path: () => `/api/items/${a.itemId}` },
  ])("$name", async ({ method, path }) => {
    const res = await send(method, path());

    expect(res.status).toBe(401);
    // 何も作られず、何も消えていない(A・B のリスト2つとアイテム2つのまま)
    expect(await prisma.gearList.count()).toBe(2);
    expect(await prisma.gearItem.count()).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// リスト(S4-07〜15)
// ---------------------------------------------------------------------------
describe("GET /api/lists/:id", () => {
  test("自分のリストは、アイテム込みで取得できる", async () => {
    const res = await send("GET", `/api/lists/${a.listId}`, a.cookie);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      id: a.listId,
      title: "a@example.com のリスト",
      items: [{ id: a.itemId, name: "ストック" }],
    });
  });

  test("他人のリストは 404", async () => {
    const res = await send("GET", `/api/lists/${b.listId}`, a.cookie);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "リストが見つかりません" });
  });

  test("存在しない ID は、他人のときとまったく同じレスポンスになる", async () => {
    const other = await send("GET", `/api/lists/${b.listId}`, a.cookie);
    const missing = await send("GET", `/api/lists/${MISSING_ID}`, a.cookie);

    expect(missing.status).toBe(other.status);
    expect(await missing.json()).toEqual(await other.json());
  });
});

describe("PATCH /api/lists/:id", () => {
  test("自分のリストは更新できる", async () => {
    const res = await send("PATCH", `/api/lists/${a.listId}`, a.cookie, { title: "変更後" });

    expect(res.status).toBe(200);
    const saved = await prisma.gearList.findUnique({ where: { id: a.listId } });
    expect(saved?.title).toBe("変更後");
  });

  test("他人のリストは 404 で、DB は書き換わらない", async () => {
    const res = await send("PATCH", `/api/lists/${b.listId}`, a.cookie, { title: "乗っ取り" });

    expect(res.status).toBe(404);
    const saved = await prisma.gearList.findUnique({ where: { id: b.listId } });
    expect(saved?.title).toBe("b@example.com のリスト");
  });

  test("存在しない ID は、他人のときとまったく同じレスポンスになる", async () => {
    const other = await send("PATCH", `/api/lists/${b.listId}`, a.cookie, { title: "x" });
    const missing = await send("PATCH", `/api/lists/${MISSING_ID}`, a.cookie, { title: "x" });

    expect(missing.status).toBe(other.status);
    expect(await missing.json()).toEqual(await other.json());
  });
});

describe("DELETE /api/lists/:id", () => {
  test("自分のリストを消すと、中のアイテムも一緒に消える", async () => {
    const res = await send("DELETE", `/api/lists/${a.listId}`, a.cookie);

    expect(res.status).toBe(204);
    expect(await prisma.gearList.findUnique({ where: { id: a.listId } })).toBeNull();
    expect(await prisma.gearItem.findMany({ where: { gearListId: a.listId } })).toHaveLength(0);
  });

  test("他人のリストは 404 で、リストもアイテムも残っている", async () => {
    const res = await send("DELETE", `/api/lists/${b.listId}`, a.cookie);

    expect(res.status).toBe(404);
    expect(await prisma.gearList.findUnique({ where: { id: b.listId } })).not.toBeNull();
    expect(await prisma.gearItem.findUnique({ where: { id: b.itemId } })).not.toBeNull();
  });

  test("存在しない ID は、他人のときとまったく同じレスポンスになる", async () => {
    const other = await send("DELETE", `/api/lists/${b.listId}`, a.cookie);
    const missing = await send("DELETE", `/api/lists/${MISSING_ID}`, a.cookie);

    expect(missing.status).toBe(other.status);
    expect(await missing.json()).toEqual(await other.json());
  });
});

// ---------------------------------------------------------------------------
// アイテム(S4-16〜24)
// ---------------------------------------------------------------------------
describe("POST /api/lists/:listId/items", () => {
  test("自分のリストにはアイテムを追加できる", async () => {
    const res = await send("POST", `/api/lists/${a.listId}/items`, a.cookie, { name: "ヘッドランプ" });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ name: "ヘッドランプ", gearListId: a.listId });
    expect(await prisma.gearItem.count({ where: { gearListId: a.listId } })).toBe(2);
  });

  test("他人のリストには追加できず 404 で、アイテムは増えない", async () => {
    const res = await send("POST", `/api/lists/${b.listId}/items`, a.cookie, { name: "ヘッドランプ" });

    expect(res.status).toBe(404);
    expect(await prisma.gearItem.count({ where: { gearListId: b.listId } })).toBe(1);
  });

  test("存在しない ID は、他人のときとまったく同じレスポンスになる", async () => {
    const other = await send("POST", `/api/lists/${b.listId}/items`, a.cookie, { name: "x" });
    const missing = await send("POST", `/api/lists/${MISSING_ID}/items`, a.cookie, { name: "x" });

    expect(missing.status).toBe(other.status);
    expect(await missing.json()).toEqual(await other.json());
  });
});

describe("PATCH /api/items/:id", () => {
  test("自分のアイテムはチェックを付けられる", async () => {
    const res = await send("PATCH", `/api/items/${a.itemId}`, a.cookie, { checked: true });

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: a.itemId, checked: true });
    const saved = await prisma.gearItem.findUnique({ where: { id: a.itemId } });
    expect(saved?.checked).toBe(true);
  });

  test("他人のアイテムは 404 で、チェックは付かない", async () => {
    const res = await send("PATCH", `/api/items/${b.itemId}`, a.cookie, { checked: true });

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "アイテムが見つかりません" });
    const saved = await prisma.gearItem.findUnique({ where: { id: b.itemId } });
    expect(saved?.checked).toBe(false);
  });

  test("存在しない ID は、他人のときとまったく同じレスポンスになる", async () => {
    const other = await send("PATCH", `/api/items/${b.itemId}`, a.cookie, { checked: true });
    const missing = await send("PATCH", `/api/items/${MISSING_ID}`, a.cookie, { checked: true });

    expect(missing.status).toBe(other.status);
    expect(await missing.json()).toEqual(await other.json());
  });
});

describe("DELETE /api/items/:id", () => {
  test("自分のアイテムは削除できる", async () => {
    const res = await send("DELETE", `/api/items/${a.itemId}`, a.cookie);

    expect(res.status).toBe(204);
    expect(await prisma.gearItem.findUnique({ where: { id: a.itemId } })).toBeNull();
  });

  test("他人のアイテムは 404 で、削除されない", async () => {
    const res = await send("DELETE", `/api/items/${b.itemId}`, a.cookie);

    expect(res.status).toBe(404);
    expect(await prisma.gearItem.findUnique({ where: { id: b.itemId } })).not.toBeNull();
  });

  test("存在しない ID は、他人のときとまったく同じレスポンスになる", async () => {
    const other = await send("DELETE", `/api/items/${b.itemId}`, a.cookie);
    const missing = await send("DELETE", `/api/items/${MISSING_ID}`, a.cookie);

    expect(missing.status).toBe(other.status);
    expect(await missing.json()).toEqual(await other.json());
  });
});

// ---------------------------------------------------------------------------
// 所有者の偽装: ボディに他人の ID を入れても無視される(S4-25〜26)
// Rails でいう strong parameters(mass assignment 対策)の確認。
// 今は Zod が未定義のキーを捨てるので守れているが、スキーマに userId などを
// 足した瞬間に壊れる場所なので、テストで固定しておく
// ---------------------------------------------------------------------------
describe("所有者の偽装", () => {
  test("POST /api/lists に userId を入れても、作成者はログイン中のユーザーになる", async () => {
    const res = await send("POST", "/api/lists", a.cookie, { title: "偽装", userId: b.userId });

    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ title: "偽装", userId: a.userId });
    expect(await prisma.gearList.count({ where: { userId: b.userId } })).toBe(1);
  });

  test("PATCH /api/items/:id に gearListId を入れても、他人のリストへ移動しない", async () => {
    const res = await send("PATCH", `/api/items/${a.itemId}`, a.cookie, {
      checked: true,
      gearListId: b.listId,
    });

    expect(res.status).toBe(200);
    const saved = await prisma.gearItem.findUnique({ where: { id: a.itemId } });
    expect(saved?.gearListId).toBe(a.listId);
  });
});

// ---------------------------------------------------------------------------
// セッション(S4-27〜29)。auth.test.ts ではモックにした validateSession を、
// 本物の DB で確かめる
// ---------------------------------------------------------------------------
describe("セッションの期限切れ", () => {
  test("期限切れの Cookie は 401 で、そのセッションは DB から消える", async () => {
    const expired = await prisma.session.create({
      data: {
        id: "expired-session",
        userId: a.userId,
        // 1秒前 = すでに期限切れ
        expiresAt: new Date(Date.now() - 1000),
      },
    });

    const res = await send("GET", "/api/lists", `session_id=${expired.id}`);

    expect(res.status).toBe(401);
    expect(await prisma.session.findUnique({ where: { id: expired.id } })).toBeNull();
  });

  test("DB に存在しないセッション ID の Cookie は 401", async () => {
    const res = await send("GET", "/api/lists", "session_id=does-not-exist");

    expect(res.status).toBe(401);
  });

  // /me は requireAuth を通らず、同じ判定を auth.ts 側に自前で持っているため別に確かめる
  test("GET /api/auth/me も、期限切れの Cookie なら 401", async () => {
    await prisma.session.create({
      data: { id: "expired-session", userId: a.userId, expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await send("GET", "/api/auth/me", "session_id=expired-session");

    expect(res.status).toBe(401);
  });
});
