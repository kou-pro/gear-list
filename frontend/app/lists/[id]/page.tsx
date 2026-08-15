import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchList } from "@/lib/api";
import CreateItemForm from "@/components/CreateItemForm";
import ItemCheckbox from "@/components/ItemCheckbox";
import DeleteItemButton from "@/components/DeleteItemButton";

// 動的セグメント [id] の値は params として渡される。
// Next.js 15 以降、params は Promise なので await で取り出す
export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

      <ul className="mt-6">
        {list.items?.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between border-b border-black/10 py-3 last:border-b-0 dark:border-white/15"
          >
            <label className="flex flex-1 cursor-pointer items-center gap-3">
              <ItemCheckbox id={item.id} checked={item.checked} />
              {/* チェック済みは打ち消し線で視覚的に区別する */}
              <span className={item.checked ? "line-through opacity-50" : ""}>
                {item.name} ×{item.quantity}
              </span>
            </label>
            <DeleteItemButton id={item.id} name={item.name} />
          </li>
        ))}
      </ul>
    </main>
  );
}
