import type { GearItem, GearList } from "@/types/gear";

const API_BASE = "http://localhost:8787/api";

// 認証中のユーザー。バックエンドの SessionUser と対応する
export type AuthUser = {
  id: number;
  email: string;
};

/**
 * 認証付きで API を呼ぶための共通ラッパー。
 *
 * Cookie の送り方が実行環境で異なるため、ここで吸収する。
 * - Client Component(ブラウザ): credentials: "include" を付けるとブラウザが Cookie を送る
 * - Server Component(Next.js サーバー): サーバー間通信なのでブラウザの Cookie は自動で乗らない。
 *   next/headers の cookies() で受信済みの Cookie を取り出し、ヘッダとして明示的に転送する
 */
async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);

  // window が無い = サーバー側で実行されている
  if (typeof window === "undefined") {
    // next/headers はサーバー専用のため、クライアントに含まれないよう動的 import する
    const { cookies } = await import("next/headers");
    const cookieHeader = (await cookies()).toString();
    if (cookieHeader) {
      headers.set("Cookie", cookieHeader);
    }
  }

  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    // ブラウザから呼ばれた場合に Cookie を送受信させる。
    // バックエンド側の cors({ credentials: true }) と対で機能し、片方だけでは動かない
    credentials: "include",
  });
}

// レスポンスのエラーボディから { error: "..." } を取り出す。
// 取り出せない場合は呼び出し側が指定した既定文言を使う
async function toError(res: Response, fallback: string): Promise<Error> {
  const body = await res.json().catch(() => null);
  return new Error(body?.error ?? fallback);
}

export async function fetchLists(): Promise<GearList[]> {
  const res = await apiFetch("/lists");

  if (!res.ok) {
    throw await toError(res, "リストの取得に失敗しました");
  }

  return await res.json();
}

// POST /api/lists — リストを新規作成する。
// GET と違い、メソッド・ヘッダ・ボディを明示的に指定する必要がある
export async function createList(input: {
  title: string;
  description: string | null;
}): Promise<GearList> {
  const res = await apiFetch(`/lists`, {
    method: "POST",
    // これが無いと Hono の zValidator("json", ...) が反応しない(curl のときと同じ)
    headers: { "Content-Type": "application/json" },
    // JavaScript のオブジェクトを JSON 文字列に変換して送る
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    // バックエンドは { error: "..." } 形式で返すので、その中身をそのまま使う
    throw await toError(res, "リストの作成に失敗しました");
  }

  return await res.json();
}

// DELETE /api/lists/:id — リストを削除する(所属アイテムは DB 側の Cascade で連動削除)。
// 成功時は 204 No Content でボディが無いため、戻り値は void とし res.json() を呼ばない
export async function deleteList(id: number): Promise<void> {
  const res = await apiFetch(`/lists/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw await toError(res, "リストの削除に失敗しました");
  }

  // 204 はボディを持てない。ここで res.json() を呼ぶとパースエラーになる
}

// GET /api/lists/:id — リスト1件を所属アイテムごと取得する。
// 存在しない場合は例外ではなく null を返す。呼び出し側(詳細画面)が
// null を見て Next.js の notFound() を呼び、404 ページに切り替えるため
export async function fetchList(id: number): Promise<GearList | null> {
  const res = await apiFetch(`/lists/${id}`);

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw await toError(res, "リストの取得に失敗しました");
  }

  return await res.json();
}

// POST /api/lists/:listId/items — アイテムを追加する
export async function createItem(
  listId: number,
  input: { name: string; quantity?: number },
): Promise<GearItem> {
  const res = await apiFetch(`/lists/${listId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await toError(res, "アイテムの追加に失敗しました");
  }

  return await res.json();
}

// PATCH /api/items/:id — アイテムの部分更新(チェック切替・名称・数量)
export async function updateItem(
  id: number,
  input: { name?: string; quantity?: number; checked?: boolean },
): Promise<GearItem> {
  const res = await apiFetch(`/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await toError(res, "アイテムの更新に失敗しました");
  }

  return await res.json();
}

// DELETE /api/items/:id — アイテムを削除する(204 なのでボディは読まない)
export async function deleteItem(id: number): Promise<void> {
  const res = await apiFetch(`/items/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    throw await toError(res, "アイテムの削除に失敗しました");
  }
}

// ── 認証 ──────────────────────────────────────────────

// POST /api/auth/signup — ユーザー登録。成功するとそのままログイン状態になる
export async function signup(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const res = await apiFetch("/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await toError(res, "登録に失敗しました");
  }

  return await res.json();
}

// POST /api/auth/login — ログイン。成功するとセッション Cookie が発行される
export async function login(input: {
  email: string;
  password: string;
}): Promise<AuthUser> {
  const res = await apiFetch("/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    throw await toError(res, "ログインに失敗しました");
  }

  return await res.json();
}

// POST /api/auth/logout — ログアウト。204 なのでボディは読まない
export async function logout(): Promise<void> {
  const res = await apiFetch("/auth/logout", { method: "POST" });

  if (!res.ok) {
    throw await toError(res, "ログアウトに失敗しました");
  }
}

// GET /api/auth/me — 現在ログイン中のユーザーを取得する。
// 未ログイン(401)は「エラー」ではなく「ログインしていない状態」なので、
// 例外にせず null を返す。呼び出し側はこれを見てリダイレクトを判断する
export async function fetchCurrentUser(): Promise<AuthUser | null> {
  const res = await apiFetch("/auth/me");

  if (res.status === 401) {
    return null;
  }
  if (!res.ok) {
    throw await toError(res, "ユーザー情報の取得に失敗しました");
  }

  return await res.json();
}

