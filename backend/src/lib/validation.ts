import type { Env } from "hono";
import type { Hook } from "@hono/zod-validator";

// Zod の検証失敗時に、REQUIREMENTS.md のエラー形式 { error: "..." } で 400 を返す共通 hook。
// 各ルートの zValidator 第3引数にこれを渡す。
export const validationHook: Hook<unknown, Env, string> = (result, c) => {
  if (!result.success) {
    const message = result.error.issues
      .map((issue) => issue.message)
      .join(", ");
    return c.json({ error: message }, 400);
  }
};
