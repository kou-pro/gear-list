"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateItem } from "@/lib/api";
import { emptyStack, isEmpty, peek, push, pop, type Stack } from "@/lib/stack";
import type { GearItem } from "@/types/gear";
import ItemCheckbox from "@/components/ItemCheckbox";
import DeleteItemButton from "@/components/DeleteItemButton";

// 1回のチェック操作を「元に戻せる単位」として記録したもの。
// before に操作前の値を持たせるのがポイント。Undo は「before を書き戻す」だけで済む
export type ToggleOp = {
  itemId: number;
  name: string; // ボタンのラベルに出す(「元に戻す: ストック」)
  before: boolean; // 操作の直前の checked 値
};

type Props = {
  items: GearItem[];
};

export default function ItemList({ items }: Props) {
  // 操作履歴を Stack で持つ。
  //
  // Queue(メール送信)は DB に永続化したが、こちらはメモリ(useState)に置く。
  // Undo 履歴は「その画面を開いている間」だけ意味があり、他のプロセスと共有する必要も
  // 再起動後に復元する必要もないため。エディタの Undo と同じ性質
  const [history, setHistory] = useState<Stack<ToggleOp>>(emptyStack<ToggleOp>());
  const [undoing, setUndoing] = useState(false);
  const router = useRouter();

  // チェックが切り替わったら履歴に積む
  function recordToggle(item: GearItem, before: boolean) {
    // 直前の state を引数で受け取る関数形式で更新する。
    // setHistory(push(history, op)) と書くと、素早く連続でチェックしたときに
    // 古い history を元にした更新で上書きしてしまい、操作が失われる
    setHistory((h) => push(h, { itemId: item.id, name: item.name, before }));
  }

  async function handleUndo() {
    const { item: op, stack: rest } = pop(history);

    // ボタンは disabled にしてあるので通常ここには来ないが、型の絞り込みのために必要
    if (!op) {
      return;
    }

    // API を呼ぶ前に履歴を進めておく。
    // 対象アイテムが既に削除されていると PATCH は 404 で失敗するが、その操作を履歴に
    // 残したままにすると以降ずっと同じ失敗を繰り返して Undo が詰まる。
    // 「戻せない操作は捨てて次へ進む」方が利用者の期待に合う
    setHistory(rest);
    setUndoing(true);

    try {
      // before(操作前の値)を書き戻すことが Undo の実体
      await updateItem(op.itemId, { checked: op.before });
      // 表示は Server Component が持っているので、サーバーに再取得させる。
      // このとき history(useState)は保持される
      router.refresh();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "元に戻せませんでした");
    } finally {
      setUndoing(false);
    }
  }

  const next = peek(history);

  return (
    <div>
      <button
        type="button"
        onClick={handleUndo}
        disabled={isEmpty(history) || undoing}
        aria-label="直前のチェック操作を元に戻す"
        className="mt-4 rounded border border-black/20 px-3 py-1.5 text-sm hover:bg-black/5 disabled:opacity-40 dark:border-white/25 dark:hover:bg-white/10"
      >
        {next ? `元に戻す: ${next.name}` : "元に戻す"}
      </button>

      <ul className="mt-6">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between border-b border-black/10 py-3 last:border-b-0 dark:border-white/15"
          >
            <label className="flex flex-1 cursor-pointer items-center gap-3">
              <ItemCheckbox
                id={item.id}
                checked={item.checked}
                onToggled={(before) => recordToggle(item, before)}
              />
              {/* チェック済みは打ち消し線で視覚的に区別する */}
              <span className={item.checked ? "line-through opacity-50" : ""}>
                {item.name} ×{item.quantity}
              </span>
            </label>
            <DeleteItemButton id={item.id} name={item.name} />
          </li>
        ))}
      </ul>
    </div>
  );
}
