"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createList } from "@/lib/api";

export default function CreateListForm() {
  // 入力欄の値を React に持たせる(制御コンポーネント)。
  // 画面の表示は常に「この状態変数の中身」になる
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  // 二重送信を防ぐためのフラグ
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // ブラウザ標準のフォーム送信(ページ全体がリロードされる)を止める
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // 空欄のときは空文字ではなく null を送る(「説明なし」を DB の NULL で表すため)
      await createList({
        title,
        description: description === "" ? null : description,
      });

      // 送信できたら入力欄を空に戻す
      setTitle("");
      setDescription("");

      // Server Component が取得済みの一覧を最新化する。
      // これを呼ばないと、作成しても画面上のリストは古いまま
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "作成に失敗しました");
    } finally {
      // 成功・失敗どちらでもボタンを押せる状態に戻す
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-2">
      <input
        type="text"
        // value と onChange をセットで書くのが制御コンポーネントの作法。
        // onChange が無いと入力しても文字が出ない(状態が変わらないため)
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="リスト名(例: 夏山日帰り)"
        className="rounded border border-black/20 px-3 py-2 dark:border-white/25"
      />

      <input
        type="text"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="説明(任意)"
        className="rounded border border-black/20 px-3 py-2 dark:border-white/25"
      />

      <button
        type="submit"
        // 送信中、またはタイトルが空(空白のみを含む)のときは押せないようにする
        disabled={submitting || title.trim() === ""}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {submitting ? "作成中..." : "作成"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
