"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateItem } from "@/lib/api";

type Props = {
  id: number;
  checked: boolean;
};

export default function ItemCheckbox({ id, checked }: Props) {
  // 連打による二重送信を防ぐ
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange() {
    setSaving(true);
    try {
      // !checked で現在の状態を反転して送る(済→未、未→済)
      await updateItem(id, { checked: !checked });
      // 表示は Server Component が持っているので、サーバーに再取得させる
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "更新に失敗しました");
    } finally {
      setSaving(false);
    }
  }

  return (
    <input
      type="checkbox"
      checked={checked}
      onChange={handleChange}
      disabled={saving}
      className="h-5 w-5 accent-green-600"
      aria-label="パッキング済み"
    />
  );
}
