import { prisma } from "../lib/prisma.js";

// テスト用 DB の接続先。.env.test と docker-compose.yml の db-test に合わせる
const TEST_DB_PORT = "5433";
const TEST_DB_NAME = "/gearlist_test";

// 全テーブルのデータを消して、テストをまっさらな状態から始められるようにする。
// Rails でいう DatabaseCleaner の役割
export async function resetDb(): Promise<void> {
  // 安全装置(Prisma 公式の手順には無い追加分)。
  // 接続先を間違えると開発用 DB のデータを全部消してしまうため、
  // テスト用 DB でなければ何も消さずにテストを止める
  const url = new URL(process.env.DATABASE_URL ?? "");
  if (url.port !== TEST_DB_PORT || url.pathname !== TEST_DB_NAME) {
    throw new Error(
      `テスト用 DB 以外には接続できません(接続先: ${url.host}${url.pathname})`,
    );
  }

  // 子テーブル → 親テーブルの順に消す(外部キー制約に引っかからないように)。
  // $transaction にまとめて、途中で失敗したら全部取り消されるようにする
  await prisma.$transaction([
    prisma.gearItem.deleteMany(),
    prisma.gearList.deleteMany(),
    prisma.session.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.job.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}
