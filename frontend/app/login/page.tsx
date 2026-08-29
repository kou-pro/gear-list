import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/lib/api";
import LoginForm from "@/components/LoginForm";

// app/login/page.tsx → URL は /login
export default async function LoginPage() {
  // すでにログイン済みならログイン画面を見せる意味がないので一覧へ送る
  const user = await fetchCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="mx-auto w-full max-w-sm p-8">
      <h1 className="text-2xl font-bold">ログイン</h1>

      <LoginForm />

      <p className="mt-6 text-sm opacity-70">
        アカウントをお持ちでない方は{" "}
        <Link href="/signup" className="underline">
          新規登録
        </Link>
      </p>
    </main>
  );
}
