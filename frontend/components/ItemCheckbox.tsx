"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateItem } from "@/lib/api";

type Props = {
  id: number;
  checked: boolean;
  // 更新が成功したときに「操作前の値」を親へ知らせる。
  // 親(ItemList)はこれを Undo 用の履歴スタックに積む。
  // optional にしてあるのは、履歴を持たない使い方も壊さないため
  onToggled?: (before: boolean) => void;
};

export default function ItemCheckbox({ id, checked, onToggled }: Props) {
  // 連打による二重送信を防ぐ
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleChange() {
    setSaving(true);
    try {
      // !checked で現在の状態を反転して送る(済→未、未→済)
      await updateItem(id, { checked: !checked });

      // 成功したときだけ履歴に積む(失敗した操作は「戻す」対象にならない)。
      // この時点の checked はまだ refresh 前なので「操作前の値」を指している
      onToggled?.(checked);

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
