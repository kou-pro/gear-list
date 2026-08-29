import Link from "next/link";
import { verifyEmail } from "@/lib/api";

// メール内の確認リンク(/verify-email?token=...)の着地ページ。
// ログイン不要で開ける(登録した端末と別の端末でメールを開くこともあるため)。
// searchParams も params と同様、Next.js 15 以降は Promise で渡される
export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  // Server Component のレンダリング中に検証 API を呼ぶ。
  // トークンは使い捨てなので、成功後にリロードすると「無効」表示になるが、
  // 確認自体は完了しているため実害はない
  const verified = token ? await verifyEmail(token) : false;

  return (
    <main className="mx-auto w-full max-w-sm p-8">
      {verified ? (
        <>
          <h1 className="text-2xl font-bold">確認が完了しました</h1>
          <p className="mt-4 text-sm opacity-70">
            メールアドレスの確認が完了しました。
          </p>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">確認できませんでした</h1>
          <p className="mt-4 text-sm opacity-70">
            リンクが無効か、期限切れ(24時間)です。
          </p>
        </>
      )}

      <p className="mt-6">
        <Link href="/" className="underline">
          Gear List へ
        </Link>
      </p>
    </main>
  );
}
