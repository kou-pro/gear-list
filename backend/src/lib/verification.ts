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
