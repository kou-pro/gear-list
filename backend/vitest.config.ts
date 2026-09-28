import { configDefaults, defineConfig } from "vitest/config";

// 単体テスト用の設定(npm test)。DB は使わない。
// DB を使うテスト(*.int.test.ts)は vitest.config.integration.ts で別に実行する
export default defineConfig({
  test: {
    // テストはソースの隣に置く(例: src/schemas/item.ts の隣に item.test.ts)。
    // src に限定するのは、npm run build 後の dist/ にもコンパイル済みの
    // *.test.js が出力されるため。src を指定しないと同じテストが2回走ってしまう
    include: ["src/**/*.test.ts"],
    // exclude を書くと既定値(node_modules 等)が置き換わるため、既定値に追加する形で書く
    exclude: [...configDefaults.exclude, "src/**/*.int.test.ts"],
  },
});
