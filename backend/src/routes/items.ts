import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma.js";
import { itemIdParamSchema, updateItemSchema } from "../schemas/item.js";
import { validationHook } from "../lib/validation.js";
import { PrismaClientKnownRequestError } from "../generated/prisma/internal/prismaNamespace.js";

const app = new Hono();

// PATCH /:id — 実際のURLは PATCH /api/items/:id
// チェック切替(checked)・名称変更・数量変更を1つのエンドポイントで扱う
app.patch(
  "/:id",
  zValidator("param", itemIdParamSchema, validationHook),
  zValidator("json", updateItemSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");

    try {
      const updated = await prisma.gearItem.update({ where: { id }, data });
      return c.json(updated);
    } catch (err) {
      // 更新対象のアイテムが存在しない場合は P2025
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return c.json({ error: "アイテムが見つかりません" }, 404);
      }
      throw err;
    }
  },
);

// DELETE /:id — 実際のURLは DELETE /api/items/:id
app.delete(
  "/:id",
  zValidator("param", itemIdParamSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");

    try {
      await prisma.gearItem.delete({ where: { id } });
      // 204 No Content はボディを持てないため c.json() は使えない
      return c.body(null, 204);
    } catch (err) {
      if (
        err instanceof PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return c.json({ error: "アイテムが見つかりません" }, 404);
      }
      throw err;
    }
  },
);

export default app;
