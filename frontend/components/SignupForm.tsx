"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signup } from "@/lib/api";

export default function SignupForm() {
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
      // バックエンドは登録成功時にそのままセッションを発行するため、
      // 登録後に改めてログインさせる必要はない
      await signup({ email, password });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="メールアドレス"
        autoComplete="email"
        className="rounded border border-black/20 px-3 py-2 dark:border-white/25"
      />
      {/* 新規登録なので new-password。パスワードマネージャに
          「保存済みの値を入れる」のではなく「新しく生成する」ことを伝える */}
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="パスワード(8文字以上)"
        autoComplete="new-password"
        className="rounded border border-black/20 px-3 py-2 dark:border-white/25"
      />
      <button
        type="submit"
        disabled={submitting || email === "" || password === ""}
        className="rounded bg-black px-4 py-2 text-white disabled:opacity-40 dark:bg-white dark:text-black"
      >
        {submitting ? "登録中..." : "登録"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
