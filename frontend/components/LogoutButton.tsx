"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "@/lib/api";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClick() {
    setLoading(true);
    try {
      // サーバー側のセッションも破棄される。
      // Cookie を消すだけでは、控えられた ID が使い続けられてしまうため
      await logout();
      router.push("/login");
      // ログアウト後にキャッシュが残っていると、戻るボタンで
      // ログイン中の画面が再表示されてしまうため作り直させる
      router.refresh();
    } catch {
      // ログアウトの失敗は稀。専用の表示欄を設けず簡易に通知する
      window.alert("ログアウトに失敗しました");
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-sm opacity-70 hover:underline disabled:opacity-40"
    >
      {loading ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
