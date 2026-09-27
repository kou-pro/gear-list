import { describe, expect, test } from "vitest";
import { createItemSchema } from "./item.js";

describe("createItemSchema の name", () => {
  // 有効クラス: 検証を通り、trim された値になる
  test.each([
    { no: "No.1", label: "日本語の文字列", input: "あいう", expected: "あいう" },
    { no: "No.2", label: "1文字(下限の境界値)", input: "A", expected: "A" },
    { no: "No.6", label: "前後に半角スペース×2", input: "  A  ", expected: "A" },
  ])("$no $label は有効で、値は $expected になる", ({ input, expected }) => {
    const result = createItemSchema.safeParse({ name: input });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ name: expected });
  });

  // 無効クラス: trim 後に0文字
  test.each([
    { no: "No.3", label: "空文字(下限の境界値の1つ下)", input: "" },
    { no: "No.4", label: "半角スペース×3", input: "   " },
    { no: "No.5", label: "全角スペース×1", input: "　" },
  ])("$no $label は必須エラーになる", ({ input }) => {
    const result = createItemSchema.safeParse({ name: input });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("name は必須です");
  });

  // 無効クラス: 文字列以外
  test.each([
    { no: "No.7", label: "数値", body: { name: 123 } },
    { no: "No.8", label: "キー省略", body: {} },
  ])("$no $label は型エラーになる", ({ body }) => {
    const result = createItemSchema.safeParse(body);

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("name は文字列で指定してください");
  });
});
