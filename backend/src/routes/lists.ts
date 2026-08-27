import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma.js";
import { createListSchema, listIdParamSchema, updateListSchema } from "../schemas/list.js";
// schemas/list.ts の listIdParamSchema と名前が衝突するため as で別名を付ける
import {
  createItemSchema,
  listIdParamSchema as itemsListIdParamSchema,
} from "../schemas/item.js";
import { validationHook } from "../lib/validation.js";
import { requireAuth, type AuthEnv } from "../middleware/auth.js";
import { PrismaClientKnownRequestError } from "../generated/prisma/internal/prismaNamespace.js";

// <AuthEnv> を付けることで c.get("user") の戻り値が SessionUser として推論される
const app = new Hono<AuthEnv>();

// このルーター配下の全エンドポイントに認証を要求する。
// "*" は「このルーター内の全パス」の意味。個々のハンドラに書くより漏れがない
app.use("*", requireAuth);

// GET / — index.ts 側で /api/lists にマウントされるので、実際のURLは GET /api/lists
app.get("/", async (c) => {
  // 認証ミドルウェアが c.set したユーザー。ここに到達している時点で認証は済んでいる
  const user = c.get("user");

  // where で自分の userId に絞る。これが Authorization(認可)の実体。
  // 「ログインしている」だけでは他人のリストを見てよいことにはならない
  const lists = await prisma.gearList.findMany({
    where: { userId: user.id },
    // orderBy が無いと PostgreSQL は物理格納順で返し、UPDATE された行が末尾へ移動して
    // 画面上の並びが不安定になるため、id 順を明示する
    orderBy: { id: "asc" },
  });
  return c.json(lists);
});

// GET /:id — 実際のURLは GET /api/lists/:id
app.get(
  "/:id",
  zValidator("param", listIdParamSchema, validationHook),
  async (c) => {
    // valid("param") が返すのは { id: number } というオブジェクト。
    // 分割代入で中の id だけを取り出す
    const { id } = c.req.valid("param");
    const user = c.get("user");

    // include で GearList に紐づく GearItem も一緒に取得する(Rails の includes 相当)。
    // items にも orderBy を指定。無いとチェック(UPDATE)のたびに行が末尾へ移動してしまう。
    // findUnique は複合条件を受け付けないため findFirst を使う
    const list = await prisma.gearList.findFirst({
      // userId を条件に加えることで、他人のリストは「存在しない」扱いになる
      where: { id, userId: user.id },
      include: { items: { orderBy: { id: "asc" } } },
    });

    // 他人のリストも、存在しないリストも、同じ 404 を返す。
    // 403 を返すと「その id は実在するが権限がない」と伝わり、
    // id の総当たりでリソースの存在を調べられてしまう
    if (!list) {
      return c.json({ error: "リストが見つかりません" }, 404);
    }

    return c.json(list);
  },
);

// POST / — 実際のURLは POST /api/lists
app.post(
  "/",
  zValidator("json", createListSchema, validationHook),
  async (c) => {
    // 検証済み・型付きのデータを取り出す(生の c.req.json() ではない)
    const data = c.req.valid("json");
    const user = c.get("user");

    // 作成者を必ずログイン中のユーザーにする。
    // クライアントから userId を受け取る設計にすると、他人になりすまして
    // リストを作れてしまうため、ボディの値は使わずサーバー側で決める
    const created = await prisma.gearList.create({
      data: { ...data, userId: user.id },
    });
    // REQUIREMENTS.md の指定どおり、作成成功は 201 を返す
    return c.json(created, 201);
  },
);

// PATCH /:id — 実際のURLは PATCH /api/lists/:id
app.patch(
  "/:id",
  // URL の :id と JSON ボディの両方を検証するので zValidator を2つ並べる
  zValidator("param", listIdParamSchema, validationHook),
  zValidator("json", updateListSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const user = c.get("user");

    try {
      // 省略されたフィールドは undefined のまま渡り、Prisma 側でそのカラムを更新対象から除外する。
      // 明示的な null はそのまま NULL として更新される。
      // where に userId を加えることで、他人のリストは対象外となり P2025(不在)になる
      const updated = await prisma.gearList.update({
        where: { id, userId: user.id },
        data,
      });
      return c.json(updated);
    } catch (err) {
      // 対象レコードが存在しないとき Prisma は P2025 を投げる
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return c.json({ error: "リストが見つかりません" }, 404);
      }
      // 想定外のエラーを 404 に潰すと障害の原因が隠れるため、そのまま投げ直す
      throw err;
    }
  },
);

// DELETE /:id — 実際のURLは DELETE /api/lists/:id
app.delete(
  "/:id",
  // ボディを持たないリクエストなので、検証するのは URL の :id だけ
  zValidator("param", listIdParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const user = c.get("user");

    try {
      // 所属する GearItem はスキーマの onDelete: Cascade により DB 側で連動削除される。
      // where に userId を加えることで、他人のリストは削除できず P2025(不在)になる
      await prisma.gearList.delete({ where: { id, userId: user.id } });
      // 204 No Content はボディを持てないため c.json() ではなく c.body(null, 204) を使う
      return c.body(null, 204);
    } catch (err) {
      // 対象レコードが存在しないとき Prisma は P2025 を投げる
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return c.json({ error: "リストが見つかりません" }, 404);
      }
      // 想定外のエラーを 404 に潰すと障害の原因が隠れるため、そのまま投げ直す
      throw err;
    }
  },
);

// POST /:listId/items — 実際のURLは POST /api/lists/:listId/items
app.post(
  "/:listId/items",
  zValidator("param", itemsListIdParamSchema, validationHook),
  zValidator("json", createItemSchema, validationHook),
  async (c) => {
    const { listId } = c.req.valid("param");
    const data = c.req.valid("json");
    const user = c.get("user");

    // 作成は create の where で所有者を絞れないため、先に親リストの所有者を確認する。
    // 外部キー制約(P2003)では「リストが存在するか」しか分からず、
    // 「他人のリストに勝手にアイテムを追加する」のを防げない
    const list = await prisma.gearList.findFirst({
      where: { id: listId, userId: user.id },
      select: { id: true },
    });

    // 他人のリストも、存在しないリストも、同じ 404 を返す
    if (!list) {
      return c.json({ error: "リストが見つかりません" }, 404);
    }

    // ...data で name / quantity を展開し、外部キーの gearListId を付け足す。
    // quantity が未指定なら undefined のまま渡り、DB の @default(1) が入る
    const created = await prisma.gearItem.create({
      data: { ...data, gearListId: listId },
    });
    return c.json(created, 201);
  },
);

export default app;
