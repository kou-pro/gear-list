import { hashPassword } from "../lib/password.js";
import { prisma } from "../lib/prisma.js";
import { createSession } from "../lib/session.js";

// テストで使う「ログイン済みユーザー」と、その持ち物(リスト1つ + アイテム1つ)の ID
export type Fixture = {
  userId: number;
  cookie: string;
  listId: number;
  itemId: number;
};

// ユーザーを作り、そのユーザーでログインした状態の Cookie を返す。
// 本物のログイン API を通すとパスワードのハッシュ計算(約0.3秒)が毎回かかるため、
// セッションを直接発行して時間を短くする
export async function loginAs(email: string): Promise<{ userId: number; cookie: string }> {
  const user = await prisma.user.create({
    data: { email, passwordHash: "テストでは照合しない" },
  });
  const session = await createSession(user.id);

  return { userId: user.id, cookie: `session_id=${session.id}` };
}

// ユーザーを作り、リスト1つとアイテム1つを持たせる
export async function createUserWithList(email: string): Promise<Fixture> {
  const { userId, cookie } = await loginAs(email);

  // items: { create: ... } で、リストと中のアイテムを1回でまとめて作る(ネストした create)
  const list = await prisma.gearList.create({
    data: {
      title: `${email} のリスト`,
      userId,
      items: { create: { name: "ストック" } },
    },
    include: { items: true },
  });

  return { userId, cookie, listId: list.id, itemId: list.items[0].id };
}

// 本物のパスワードハッシュを持つユーザーを作る(ログイン API のテスト用)。
// scrypt の計算が約0.3秒かかるため、ログインを試すテストでだけ使う
export async function createUserWithPassword(
  email: string,
  password: string,
): Promise<{ userId: number }> {
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password) },
  });

  return { userId: user.id };
}
