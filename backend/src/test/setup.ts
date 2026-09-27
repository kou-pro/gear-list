import { beforeEach } from "vitest";
import { resetDb } from "./reset-db.js";

// vitest.config.integration.ts の setupFiles から読み込まれ、
// すべての DB テストの「各テストの直前」にデータを空にする
beforeEach(async () => {
  await resetDb();
});
