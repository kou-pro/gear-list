import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma.js";
import { createListSchema, listIdParamSchema } from "../schemas/list.js";

const app = new Hono();

// GET / — index.ts 側で /api/lists にマウントされるので、実際のURLは GET /api/lists
app.get("/", async (c) => {
  const lists = await prisma.gearList.findMany();
  return c.json(lists);
});

// GET /:id — 実際のURLは GET /api/lists/:id
app.get(
  "/:id",
  zValidator("param", listIdParamSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");
      return c.json({ error: message }, 400);
    }
  }),
  async (c) => {
    // valid("param") が返すのは { id: number } というオブジェクト。
    // 分割代入で中の id だけを取り出す
    const { id } = c.req.valid("param");

    // include で GearList に紐づく GearItem も一緒に取得する(Rails の includes 相当)
    const list = await prisma.gearList.findUnique({
      where: { id },
      include: { items: true },
    });

    // findUnique は見つからないとき例外ではなく null を返すので、自分で 404 に変換する
    if (!list) {
      return c.json({ error: "リストが見つかりません" }, 404);
    }

    return c.json(list);
  },
);

// POST / — 実際のURLは POST /api/lists
app.post(
  "/",
  // 第3引数の hook は検証に失敗したときだけ呼ばれる。
  // ここで何も返さないと Zod 既定の形式で 400 が返るため、
  // REQUIREMENTS.md のエラー形式 { error: "..." } に揃える。
  zValidator("json", createListSchema, (result, c) => {
    if (!result.success) {
      const message = result.error.issues
        .map((issue) => issue.message)
        .join(", ");
      return c.json({ error: message }, 400);
    }
  }),
  async (c) => {
    // 検証済み・型付きのデータを取り出す(生の c.req.json() ではない)
    const data = c.req.valid("json");
    const created = await prisma.gearList.create({ data });
    // REQUIREMENTS.md の指定どおり、作成成功は 201 を返す
    return c.json(created, 201);
  },
);

export default app;
