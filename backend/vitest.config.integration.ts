import { defineConfig } from "vitest/config";

// DB を使うテスト用の設定(npm run test:int)。
// 接続先(DATABASE_URL)は package.json のスクリプトで dotenv-cli が .env.test から渡す。
// 構成は Prisma 公式ブログの Vitest 版に合わせている:
// https://www.prisma.io/blog/testing-series-3-aBUyF8nxAn
export default defineConfig({
  test: {
    include: ["src/**/*.int.test.ts"],
    // DB は1つしかないため、テストファイルを同時に実行しない。
    // 並列にすると、あるファイルの片付け(全データ削除)が別ファイルのテスト中のデータを消してしまう
    fileParallelism: false,
    // 各テストの直前にデータを空にする beforeEach を登録するファイル
    setupFiles: ["src/test/setup.ts"],
  },
});
