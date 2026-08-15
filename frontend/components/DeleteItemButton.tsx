"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteItem } from "@/lib/api";

type Props = {
  id: number;
  name: string;
};

export default function DeleteItemButton({ id, name }: Props) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (!window.confirm(`「${name}」を削除します。よろしいですか?`)) {
      return;
    }

    setDeleting(true);
    try {
      await deleteItem(id);
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "削除に失敗しました");
      setDeleting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={deleting}
      className="text-sm text-red-600 hover:underline disabled:opacity-40 dark:text-red-400"
    >
      {deleting ? "削除中..." : "削除"}
    </button>
  );
}
