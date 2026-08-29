import { randomBytes } from "node:crypto";
import { prisma } from "./prisma.js";

// セッションIDと同じ強度(32バイト = 256ビット)。
// このトークンを知っている = 確認メールを受信できた人、とみなす根拠になるため、
// 推測不能であることが必須
const TOKEN_BYTES = 32;

// 有効期限は24時間。セッション(30日)より大幅に短いのは、
// 「メールを開いて確認する」という一度きりの用途で、長く生かす理由がないため
const TOKEN_DURATION_MS = 24 * 60 * 60 * 1000;

// メールアドレス確認トークンを発行する(signup から呼ばれる)
export async function createVerificationToken(userId: number): Promise<string> {
  const id = randomBytes(TOKEN_BYTES).toString("hex");
  const expiresAt = new Date(Date.now() + TOKEN_DURATION_MS);

  await prisma.verificationToken.create({
    data: { id, userId, expiresAt },
  });

  return id;
}

// トークンを検証し、有効なら「確認済み」にして使い捨てる。
// 成功なら true、無効(不在・期限切れ)なら false を返す
export async function consumeVerificationToken(
  tokenId: string,
): Promise<boolean> {
  const token = await prisma.verificationToken.findUnique({
    where: { id: tokenId },
  });

  if (!token) {
    return false;
  }

  if (token.expiresAt < new Date()) {
    // 期限切れはその場で掃除する(セッションと同じ方針)
    await prisma.verificationToken.delete({ where: { id: tokenId } });
    return false;
  }

  // 「確認済みにする」と「トークンを消す」は必ずセットで成立させたいので
  // トランザクションにまとめる(片方だけ成功すると、使い済みトークンが残って再利用できてしまう)
  await prisma.$transaction([
    prisma.user.update({
      where: { id: token.userId },
      data: { emailVerifiedAt: new Date() },
    }),
    prisma.verificationToken.delete({ where: { id: tokenId } }),
  ]);

  return true;
}
