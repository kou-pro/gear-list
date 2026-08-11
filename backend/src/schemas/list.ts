import * as z from "zod";

// POST /api/lists のリクエストボディを検証するスキーマ。
// TypeScript の型は実行時に消えるため、外部から来る JSON は Zod で実際に検証する。
export const createListSchema = z.object({
  // 必須。前後の空白を除いたうえで1文字以上を要求する(" " だけの入力を弾くため)
  title: z
    .string("title は文字列で指定してください")
    .trim()
    .min(1, "title は必須です"),

  // 任意。省略された場合は undefined になり、Prisma 側ではそのカラムを指定しない扱いになる
  description: z
    .string("description は文字列で指定してください")
    .trim()
    .optional()
    .nullable(),
});

// スキーマから型を導出する。型を手書きすると検証とのズレが発生するため、必ず infer を使う
export type CreateListInput = z.infer<typeof createListSchema>;

export const listIdParamSchema = z.object({
  id: z.coerce
    .number("id は数値で指定してください")
    .int("idは整数で指定してください")
    .positive("id は1以上で指定してください")
    // PostgreSQL の Int(INT4)の上限。超えると Prisma が DB 送信時に例外を投げ 500 になるため、
    // 入口のバリデーションで 400 として弾く
    .max(2147483647, "id が大きすぎます"),
});

// PATCH /api/lists/:id のリクエストボディを検証するスキーマ。
// 部分更新なので、末尾の .partial() で全フィールドを「省略してよい」状態にする。
export const updateListSchema = z
  .object({
    title: z
      .string("title は文字列で指定してください")
      .trim()
      .min(1, "title は空にできません"),

    // .nullable() は「値として null を許す」。{"description": null} で説明を消せるようにするため。
    // 「キーごと省略してよい」は末尾の .partial() が担当するので、ここに .optional() は書かない
    description: z
      .string("description は文字列で指定してください")
      .trim()
      .nullable(),
  })
  .partial();

export type UpdateListInput = z.infer<typeof updateListSchema>;
