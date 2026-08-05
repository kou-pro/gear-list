// .env を process.env に読み込む。PrismaClient が DATABASE_URL を参照するため、
// 他のどの import よりも先に評価される必要がある(必ず1行目に置く)
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import listsRoute from "./routes/lists.js";

const app = new Hono();

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// lists サブアプリを /api/lists 配下にマウント(パスは先頭 "/" 付きが公式の記法)
app.route("/api/lists", listsRoute);

serve(
  {
    fetch: app.fetch,
    port: 8787,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
