"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteList } from "@/lib/api";

type Props = {
  id: number;
  title: string;
};

export default function DeleteListButton({ id, title }: Props) {
  const [deleting, setDeleting] = useState(false);
  const router = useRouter();

  async function handleClick() {
    if (!window.confirm(`「${title}」を削除します。よろしいですか?`)) {
      return;
    }

    setDeleting(true);
    try {
      await deleteList(id);
      // 一覧は Server Component が描画しているので、サーバーに作り直させる
      router.refresh();
    } catch (err) {
      // 削除失敗は稀なので、専用の表示欄は設けず alert で知らせる
      window.alert(err instanceof Error ? err.message : "削除に失敗しました");
      setDeleting(false);
    }
    // 成功時は setDeleting(false) を呼ばない。
    // refresh でこの行ごと画面から消えるため、状態を戻す必要がない
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
