import type { GearList } from "@/types/gear";

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
