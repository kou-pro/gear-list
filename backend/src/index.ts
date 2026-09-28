// .env を process.env に読み込む。PrismaClient が DATABASE_URL を参照するため、
// 他のどの import よりも先に評価される必要がある(必ず1行目に置く)。
// app.ts ではなくここで読み込むのは、テストが app.ts だけを import したときに
// 開発用の .env(開発 DB の接続先)を読み込ませないため
import "dotenv/config";
import { serve } from "@hono/node-server";
import app from "./app.js";

// サーバーの起動だけを担当する(npm run dev / npm start のときに実行される)
serve(
  {
    fetch: app.fetch,
    port: 8787,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
