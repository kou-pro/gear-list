import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { fetchCurrentUser, fetchList } from "@/lib/api";
import CreateItemForm from "@/components/CreateItemForm";
import ItemList from "@/components/ItemList";

// 動的セグメント [id] の値は params として渡される。
// Next.js 15 以降、params は Promise なので await で取り出す
export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // 未ログインならログイン画面へ。API 側でも 401 になるが、画面としては誘導するのが自然
  const user = await fetchCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;

  // URL 由来の id は文字列なので数値へ変換する。
  // /lists/abc のような不正な URL は「形式エラー(400)」ではなく「ページが無い(404)」として扱う。
  // API 層では 400 を返す設計だが、画面の URL としてはただの存在しないページのため
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId < 1) {
    notFound();
  }

  const list = await fetchList(numericId);

  // fetchList は 404 のとき null を返す設計。notFound() で Next.js の 404 ページに切り替える
  if (!list) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Link href="/" className="text-sm opacity-70 hover:underline">
        ← 一覧に戻る
      </Link>

      <h1 className="mt-2 text-2xl font-bold">{list.title}</h1>
      {list.description && (
        <p className="mt-1 text-sm opacity-70">{list.description}</p>
      )}

      <CreateItemForm listId={list.id} />

      {/* 装備一覧と Undo は操作履歴(Client の state)を共有するため、
          ItemList にまとめて委ねる。このページ自体は Server Component のまま */}
      <ItemList items={list.items ?? []} />
    </main>
  );
}
