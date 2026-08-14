// .env を process.env に読み込む。PrismaClient が DATABASE_URL を参照するため、
// 他のどの import よりも先に評価される必要がある(必ず1行目に置く)
import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import listsRoute from "./routes/lists.js";
import itemsRoute from "./routes/items.js";
import { cors } from "hono/cors";

const app = new Hono();

app.use("/api/*", cors({ origin: "http://localhost:3000" }));

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// lists サブアプリを /api/lists 配下にマウント(パスは先頭 "/" 付きが公式の記法)
app.route("/api/lists", listsRoute);

// items サブアプリを /api/items 配下にマウント。
// 作成だけは親リストに紐づくため POST /api/lists/:listId/items として lists 側に置いている
app.route("/api/items", itemsRoute);

serve(
  {
    fetch: app.fetch,
    port: 8787,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
