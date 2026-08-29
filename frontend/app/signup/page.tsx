import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchCurrentUser } from "@/lib/api";
import SignupForm from "@/components/SignupForm";

// app/signup/page.tsx → URL は /signup
export default async function SignupPage() {
  const user = await fetchCurrentUser();
  if (user) {
    redirect("/");
  }

  return (
    <main className="mx-auto w-full max-w-sm p-8">
      <h1 className="text-2xl font-bold">新規登録</h1>

      <SignupForm />

      <p className="mt-6 text-sm opacity-70">
        すでにアカウントをお持ちの方は{" "}
        <Link href="/login" className="underline">
          ログイン
        </Link>
      </p>
    </main>
  );
}
