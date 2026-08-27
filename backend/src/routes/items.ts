import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { prisma } from "../lib/prisma.js";
import { itemIdParamSchema, updateItemSchema } from "../schemas/item.js";
import { validationHook } from "../lib/validation.js";
import { requireAuth, type AuthEnv } from "../middleware/auth.js";
import { PrismaClientKnownRequestError } from "../generated/prisma/internal/prismaNamespace.js";

// <AuthEnv> を付けることで c.get("user") の戻り値が SessionUser として推論される
const app = new Hono<AuthEnv>();

// このルーター配下の全エンドポイントに認証を要求する
app.use("*", requireAuth);

// PATCH /:id — 実際のURLは PATCH /api/items/:id
// チェック切替(checked)・名称変更・数量変更を1つのエンドポイントで扱う
app.patch(
  "/:id",
  zValidator("param", itemIdParamSchema, validationHook),
  zValidator("json", updateItemSchema, validationHook),
  async (c) => {
    const { id } = c.req.valid("param");
    const data = c.req.valid("json");
    const user = c.get("user");

    try {
      // GearItem は userId を持たないため、親 GearList の所有者を条件にして絞る。
      // Prisma は where にリレーション先の条件を書けるので、JOIN を自分で書く必要はない。
      // 他人のアイテムはこの条件に合致せず P2025(不在)になる
      const updated = await prisma.gearItem.update({
        where: { id, gearList: { userId: user.id } },
        data,
      });
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
    const user = c.get("user");

    try {
      // PATCH と同じく、親 GearList の所有者を条件に加える
      await prisma.gearItem.delete({
        where: { id, gearList: { userId: user.id } },
      });
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
