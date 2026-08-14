import * as z from "zod";

// POST /api/lists/:listId/items のリクエストボディを検証するスキーマ。
// checked を受け付けないのは意図的: 新規追加した装備は必ず未パッキング(DB の @default(false))から始まる。
export const createItemSchema = z.object({
  // 必須。.trim() を .min(1) より先に置き、空白だけの入力を弾く
  name: z
    .string("name は文字列で指定してください")
    .trim()
    .min(1, "name は必須です"),

  // 任意。省略時は undefined となり、Prisma がカラムを SQL から除外して DB の @default(1) が入る。
  // フォームからは文字列で届くこともあるため coerce で数値に変換してから検証する
  quantity: z.coerce
    .number("quantity は数値で指定してください")
    .int("quantity は整数で指定してください")
    .positive("quantity は1以上で指定してください")
    .max(2147483647, "quantity が大きすぎます")
    .optional(),
});

export type CreateItemInput = z.infer<typeof createItemSchema>;

// PATCH /api/items/:id のリクエストボディ。
// 部分更新なので末尾の .partial() で全フィールドを省略可にする(個別の .optional() は書かない)。
export const updateItemSchema = z
  .object({
    name: z
      .string("name は文字列で指定してください")
      .trim()
      .min(1, "name は空にできません"),

    quantity: z.coerce
      .number("quantity は数値で指定してください")
      .int("quantity は整数で指定してください")
      .positive("quantity は1以上で指定してください")
      .max(2147483647, "quantity が大きすぎます"),

    // パッキング済みフラグ。このアプリの中核となる更新項目
    checked: z.boolean("checked は true か false で指定してください"),
  })
  .partial();

export type UpdateItemInput = z.infer<typeof updateItemSchema>;

// /api/items/:id の URL パラメータ。URL から届く値は必ず文字列なので coerce が必須。
export const itemIdParamSchema = z.object({
  id: z.coerce
    .number("id は数値で指定してください")
    .int("id は整数で指定してください")
    .positive("id は1以上で指定してください")
    .max(2147483647, "id が大きすぎます"),
});

// /api/lists/:listId/items の URL パラメータ。
// 検証ルールは itemIdParamSchema と同じだが、Hono が渡すキー名が listId なので別に定義する
export const listIdParamSchema = z.object({
  listId: z.coerce
    .number("listId は数値で指定してください")
    .int("listId は整数で指定してください")
    .positive("listId は1以上で指定してください")
    .max(2147483647, "listId が大きすぎます"),
});
