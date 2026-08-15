import type { GearItem, GearList } from "@/types/gear";

const API_BASE = "http://localhost:8787/api";

export async function fetchLists(): Promise<GearList[]> {
  const res = await fetch(`${API_BASE}/lists`);

  if (!res.ok) {
    throw new Error("リストの取得に失敗しました");
  }

  return await res.json();
}

// POST /api/lists — リストを新規作成する。
// GET と違い、メソッド・ヘッダ・ボディを明示的に指定する必要がある
export async function createList(input: {
  title: string;
  description: string | null;
}): Promise<GearList> {
  const res = await fetch(`${API_BASE}/lists`, {
    method: "POST",
    // これが無いと Hono の zValidator("json", ...) が反応しない(curl のときと同じ)
    headers: { "Content-Type": "application/json" },
    // JavaScript のオブジェクトを JSON 文字列に変換して送る
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    // バックエンドは { error: "..." } 形式で返すので、その中身をそのまま使う
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "リストの作成に失敗しました");
  }

  return await res.json();
}

// DELETE /api/lists/:id — リストを削除する(所属アイテムは DB 側の Cascade で連動削除)。
// 成功時は 204 No Content でボディが無いため、戻り値は void とし res.json() を呼ばない
export async function deleteList(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/lists/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "リストの削除に失敗しました");
  }

  // 204 はボディを持てない。ここで res.json() を呼ぶとパースエラーになる
}

// GET /api/lists/:id — リスト1件を所属アイテムごと取得する。
// 存在しない場合は例外ではなく null を返す。呼び出し側(詳細画面)が
// null を見て Next.js の notFound() を呼び、404 ページに切り替えるため
export async function fetchList(id: number): Promise<GearList | null> {
  const res = await fetch(`${API_BASE}/lists/${id}`);

  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error("リストの取得に失敗しました");
  }

  return await res.json();
}

// POST /api/lists/:listId/items — アイテムを追加する
export async function createItem(
  listId: number,
  input: { name: string; quantity?: number },
): Promise<GearItem> {
  const res = await fetch(`${API_BASE}/lists/${listId}/items`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "アイテムの追加に失敗しました");
  }

  return await res.json();
}

// PATCH /api/items/:id — アイテムの部分更新(チェック切替・名称・数量)
export async function updateItem(
  id: number,
  input: { name?: string; quantity?: number; checked?: boolean },
): Promise<GearItem> {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "アイテムの更新に失敗しました");
  }

  return await res.json();
}

// DELETE /api/items/:id — アイテムを削除する(204 なのでボディは読まない)
export async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/items/${id}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "アイテムの削除に失敗しました");
  }
}

