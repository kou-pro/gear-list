// Stack(スタック)は「後に積んだものを先に取り出す」データ構造。LIFO = Last In, First Out。
//
// Queue(先入れ先出し)との違いは「配列のどちらの端から取るか」だけ:
//   pop(stack)     → 末尾を取る   = 最後に積んだもの   → 直前の状態に戻る用途に合う
//   dequeue(queue) → 先頭を取る   = 最初に積んだもの   → 公平に順番を守る用途に合う
//
// この1行の違いが用途を分ける。Undo は「直前の操作を取り消す」ため必ず Stack でなければならない。
//
// なお React 公式は、state に入れた配列を read-only として扱うよう求めている
// (「`push()` や `pop()` のような配列を破壊するメソッドを使ってはいけない」)。
// そのためここでは配列を書き換えず、常に新しい配列を返す純粋関数として実装する。
// https://react.dev/learn/updating-arrays-in-state
export type Stack<T> = readonly T[];

// 空のスタックを作る
export function emptyStack<T>(): Stack<T> {
  return [];
}

// 積む。元の配列は変えず、末尾に item を足した新しい配列を返す。
// Array.prototype.push は元の配列を書き換えてしまうため使わない
export function push<T>(stack: Stack<T>, item: T): Stack<T> {
  return [...stack, item];
}

// 取り出す。取り出した要素と、それを除いた新しいスタックの両方を返す。
//
// 末尾を top(取り出し口)にしている理由:
// 末尾への追加・削除は他の要素の位置に影響しないが、先頭を top にすると
// 追加・削除のたびに全要素がずれるため無駄が多い。
//
// 空のときは item を undefined とし、stack はそのまま返す(呼び出し側で分岐できるように)
export function pop<T>(stack: Stack<T>): { item: T | undefined; stack: Stack<T> } {
  if (stack.length === 0) {
    return { item: undefined, stack };
  }

  return {
    item: stack[stack.length - 1],
    // slice は元の配列を変えずに新しい配列を返す(splice は破壊するので使わない)
    stack: stack.slice(0, -1),
  };
}

// 取り出さずに次に取り出されるもの(= 末尾)を覗く。
// 「元に戻す: ストック」のようなラベル表示に使う
export function peek<T>(stack: Stack<T>): T | undefined {
  return stack[stack.length - 1];
}

export function isEmpty<T>(stack: Stack<T>): boolean {
  return stack.length === 0;
}

export function size<T>(stack: Stack<T>): number {
  return stack.length;
}
