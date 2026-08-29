import Link from "next/link";
import { redirect } from "next/navigation";
import { fetchCurrentUser, fetchLists } from "@/lib/api";
import CreateListForm from "@/components/CreateListForm";
import DeleteListButton from "@/components/DeleteListButton";
import LogoutButton from "@/components/LogoutButton";

// app/page.tsx は URL "/" に対応する(App Router はディレクトリ構造がそのまま URL になる)。
// 何も指定しなければ Server Component となり、サーバー側でのみ実行される。
export default async function Home() {
  // 未ログインならログイン画面へ送る。
  // API 側でも 401 で弾かれるが、画面としては「エラー」ではなく
  // 「ログインへ誘導する」のが自然なので、ここで先に判定する
  const user = await fetchCurrentUser();
  if (!user) {
    redirect("/login");
  }

  // ここに到達している時点で認証済み。返るのは自分のリストだけ(認可はサーバー側で担保)
  const lists = await fetchLists();

  return (
    // body が flex コンテナのため、w-full が無いと幅が中身なりに縮んでしまう
    <main className="mx-auto w-full max-w-2xl p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Gear List</h1>
        <div className="flex items-center gap-3">
          <span className="text-sm opacity-70">{user.email}</span>
          {/* メールアドレス未確認の場合だけバッジを出す(ログイン自体は制限しない方針) */}
          {!user.emailVerified && (
            <span className="rounded bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600 dark:text-amber-400">
              メール未確認
            </span>
          )}
          <LogoutButton />
        </div>
      </div>

      {/* Server Component の中に Client Component を置くことはできる(逆は不可) */}
      <CreateListForm />

      <ul className="mt-6">
        {lists.map((list) => (
          // map が返す要素は1つだけ。key はその一番外側の要素に付ける
          // last:border-b-0 で最終行だけ下線を消す(下端に線が残るのを防ぐ)
          <li
            key={list.id}
            className="border-b border-black/10 py-3 last:border-b-0 dark:border-white/15"
          >
            {/* タイトルと削除ボタンを左右に配置する */}
            <div className="flex items-center justify-between gap-4">
              <Link
                href={`/lists/${list.id}`}
                className="font-medium hover:underline"
              >
                {list.title}
              </Link>

              {/* Client Component に props で値を渡す。
                  Server Component から渡せるのは JSON にできる値だけ(関数は渡せない) */}
              <DeleteListButton id={list.id} title={list.title} />
            </div>

            {/* description は null のことがあるので、値があるときだけ <p> を描画する。
                固定色ではなく opacity で薄くすると、ライト/ダークどちらでも読める */}
            {list.description && (
              <p className="mt-1 text-sm opacity-70">{list.description}</p>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
