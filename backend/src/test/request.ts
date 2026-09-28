import app from "../app.js";

// method・Cookie・JSON ボディ付きでリクエストを送る。毎回同じ設定を書かないための関数
export async function send(
  method: string,
  path: string,
  cookie?: string,
  body?: object,
): Promise<Response> {
  return app.request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      // cookie があるときだけ Cookie ヘッダを足す
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// レスポンスの Set-Cookie ヘッダから session_id の値を取り出す。無ければ null
export function sessionIdFrom(res: Response): string | null {
  const match = (res.headers.get("set-cookie") ?? "").match(/session_id=([^;]*)/);
  return match ? match[1] : null;
}
