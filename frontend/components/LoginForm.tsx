"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // 成功するとバックエンドがセッション Cookie を発行し、ブラウザが保存する
      await login({ email, password });

      // 一覧画面へ移動する。push は履歴に積むので、ブラウザの戻るでログイン画面に戻れる
      router.push("/");

      // Next.js は訪問済みページの描画結果をキャッシュしている。
      // refresh を呼ばないと「ログイン前に見た空の一覧」がそのまま表示されうるため、
      // サーバーに再取得させて最新の状態にする
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ログインに失敗しました");
      // 成功時は画面が遷移するので false に戻す必要はない。
      // 失敗時のみ、再入力できるようボタンを押せる状態へ戻す
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      {/* type="email" にすると形式チェックとメール用キーボードをブラウザが提供する。
          ただしこれは補助であり、防御はサーバー側の Zod 検証が担う */}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
        autoComplete="email"
        className="rounded border border-black/20 px-3 py-2 dark:border-white/25"
      />
      {/* type="password" は入力を伏せ字にし、パスワードマネージャに認識させる */}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード"
        autoComplete="current-password"
        className="rounded border border-black/20 px-3 py-2 dark:border-white/25"
      />
      <button
        type="submit"
        disabled={submitting || email === "" || password === ""}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {submitting ? "ログイン中..." : "ログイン"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
