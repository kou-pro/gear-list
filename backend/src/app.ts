import { Hono } from "hono";
import { cors } from "hono/cors";
import listsRoute from "./routes/lists.js";
import itemsRoute from "./routes/items.js";
import authRoute from "./routes/auth.js";

// アプリ本体(どの URL で何をするか)だけを定義するファイル。
// サーバーの起動(serve)は index.ts が担当する。
// 分けておくことで、テストは serve を動かさずに app.request() で本体だけを呼べる
const app = new Hono();

// credentials: true を付けないと、ブラウザは Cookie を付けて送らず、
// レスポンスの Set-Cookie も無視する。認証を Cookie で行うため必須。
// なお credentials を使う場合、origin にワイルドカード("*")は指定できない
// (今回は元から localhost:3000 に限定しているため問題ない)
app.use(
  "/api/*",
  cors({ origin: "http://localhost:3000", credentials: true }),
);

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

// lists サブアプリを /api/lists 配下にマウント(パスは先頭 "/" 付きが公式の記法)
app.route("/api/lists", listsRoute);

// items サブアプリを /api/items 配下にマウント。
// 作成だけは親リストに紐づくため POST /api/lists/:listId/items として lists 側に置いている
app.route("/api/items", itemsRoute);

// 認証系。ログイン前でもアクセスできる必要があるため、認証 middleware は適用しない
app.route("/api/auth", authRoute);

export default app;
