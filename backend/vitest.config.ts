import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // テストはソースの隣に置く(例: src/schemas/item.ts の隣に item.test.ts)。
    // src に限定するのは、npm run build 後の dist/ にもコンパイル済みの
    // *.test.js が出力されるため。src を指定しないと同じテストが2回走ってしまう
    include: ["src/**/*.test.ts"],
  },
});
