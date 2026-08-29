"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createItem } from "@/lib/api";

type Props = {
  listId: number;
};

export default function CreateItemForm({ listId }: Props) {
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // input の値は文字列なので数値に変換して送る(バックエンドは coerce 対応だが、型を合わせておく)
      await createItem(listId, { name, quantity: Number(quantity) });
      setName("");
      setQuantity("1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "追加に失敗しました");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex gap-2">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="装備名(例: 熊鈴)"
        className="flex-1 rounded border border-black/20 px-3 py-2 dark:border-white/25"
      />
      <input
        type="number"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        min={1}
        className="w-20 rounded border border-black/20 px-3 py-2 dark:border-white/25"
      />
      <button
        type="submit"
        disabled={submitting || name.trim() === ""}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {submitting ? "追加中..." : "追加"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
