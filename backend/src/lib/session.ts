import { randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";

// セッションID の長さ。32バイト = 256ビット。
// OWASP Session Management Cheat Sheet は最低64ビットのエントロピーを要求しており、
// それを十分に上回る。推測不能であることがセッションの唯一の防御になる
const SESSION_ID_BYTES = 32;

// 有効期限は30日。計算結果(2592000000)ではなく数式のまま書くことで、
// 「30日」という意図がコードから読み取れるようにする
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000;

// レスポンスや Context に載せるユーザー情報。
// passwordHash を絶対に含めないよう、返り値の型をここで固定しておく。
// 型で縛っておけば、うっかり user をそのまま返したときコンパイルエラーになる
export type SessionUser = {
  id: number;
  email: string;
  // メールアドレス確認済みか。フロントが「未確認」バッジの表示判断に使う
  emailVerified: boolean;
};

// ログイン成功時に呼ぶ。新しいセッションを1件発行する
export async function createSession(
  userId: number,
): Promise<{ id: string; expiresAt: Date }> {
  // DB の autoincrement を使わず、ここで乱数を生成して id にする。
  // 連番だと隣の番号を試すだけで他人になりすませてしまうため
  const id = randomBytes(SESSION_ID_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  await prisma.session.create({
    data: { id, userId, expiresAt },
  });

  return { id, expiresAt };
}

// 認証ミドルウェアから毎リクエスト呼ばれる。
// 有効なセッションならユーザーを返し、無効なら null を返す
export async function validateSession(
  sessionId: string,
): Promise<SessionUser | null> {
  // include で User も一緒に取得する。
  // userId(数値)だけでは「誰か」を表現できないため、1回のクエリでまとめて引く
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  // Cookie 側の有効期限はクライアントが改ざんできるため、
  // サーバー側に保存した expiresAt で必ず判定する
  if (session.expiresAt < new Date()) {
    // 期限切れのレコードは残しておく理由がないので、その場で削除する。
    // 定期バッチを用意しなくてもゴミが溜まらない
    await deleteSession(sessionId);
    return null;
  }

  // session.user をそのまま返すと passwordHash まで含まれてしまうため、
  // 必要なフィールドだけを取り出して返す
  return {
    id: session.user.id,
    email: session.user.email,
    emailVerified: session.user.emailVerifiedAt !== null,
  };
}

// ログアウト時に呼ぶ。該当セッションを破棄する
export async function deleteSession(sessionId: string): Promise<void> {
  // delete ではなく deleteMany を使う。
  // delete は対象が無いと P2025 を投げるが、
  // 「すでに無いセッションを消そうとした」のはエラーではないため、
  // 0件でも例外を投げない deleteMany が適している
  await prisma.session.deleteMany({
    where: { id: sessionId },
  });
}
