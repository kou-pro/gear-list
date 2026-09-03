import { prisma } from "./prisma.js";
import {
  JobStatus,
  type Job,
  type Prisma,
} from "../generated/prisma/client.js";

// ── Job の種別と、その種別が必要とするデータの対応表 ──
// ここを1箇所にまとめておくことで、enqueue する側と Worker 側で
// 「この種別にはこの形のデータが必要」という約束を型で強制できる。
// 種別を増やすときは JobType と JobPayloads の両方に足す
export type JobType = "send_verification_email";

export type JobPayloads = {
  send_verification_email: { to: string; token: string };
};

// 取り出し順。FIFO(先入れ先出し)= Queue、LIFO(後入れ先出し)= Stack。
// メール送信は「先に登録した人が先に受け取る」べきなので通常は fifo。
// lifo は Stack との違いを体感するための実験用
export type QueueOrder = "fifo" | "lifo";

// リトライの基準待ち時間。1回目失敗で5秒、2回目失敗で10秒と倍々に伸ばす。
// すぐ再試行しても相手(SMTPサーバー)が復旧していない可能性が高いため、
// 間隔を空けて相手への負荷も抑える(exponential backoff)
const BASE_RETRY_DELAY_MS = 5_000;

// attempts 回目の実行が失敗したあと、次に実行するまでの待ち時間
export function retryDelayMs(attempts: number): number {
  return BASE_RETRY_DELAY_MS * 2 ** (attempts - 1);
}

// ── Producer 側 ──
// 「後でやる仕事」をキューに積む。HTTP リクエストの処理中に呼ばれる。
// ここでやるのは DB への INSERT だけなので一瞬で終わる
export async function enqueue<T extends JobType>(
  type: T,
  payload: JobPayloads[T],
): Promise<Job> {
  return await prisma.job.create({
    data: {
      type,
      // Json カラムには構造を持ったオブジェクトをそのまま渡せる
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

// ── Consumer 側 ──
// 次に処理すべき Job を1件「獲得」する。獲得できなければ null。
//
// ここが Queue 実装の核心。複数の Worker が同時に動いても、
// 同じ Job を2回処理してはいけない(=メールが2通届いてはいけない)。
export async function claimNextJob(order: QueueOrder): Promise<Job | null> {
  // 1. 実行対象の候補を1件選ぶ。
  //    runAt <= 現在時刻 という条件により、リトライ待ちの Job は自動的に除外される
  const candidate = await prisma.job.findFirst({
    where: {
      status: JobStatus.pending,
      runAt: { lte: new Date() },
    },
    orderBy: { id: order === "lifo" ? "desc" : "asc" },
  });

  if (!candidate) {
    return null;
  }

  // 2. 「まだ pending であること」を条件に status を processing へ変える。
  //
  //    これが排他制御の本体。発行される SQL は
  //      UPDATE "Job" SET status='processing', ... WHERE id = ? AND status = 'pending'
  //    で、PostgreSQL はこの1文を不可分に実行する。
  //    2つの Worker が手順1で同じ候補を見つけても、UPDATE が成立する(count = 1)のは
  //    先に到達した1つだけ。後から来た方は WHERE の status='pending' がもう偽になっており、
  //    何も更新できずに count = 0 になる。
  //
  //    attempts はここで増やす。「取り出した = 1回試みた」と数えることで、
  //    処理中にプロセスが落ちても試行回数が失われない
  const claimed = await prisma.job.updateMany({
    where: {
      id: candidate.id,
      status: JobStatus.pending,
    },
    data: {
      status: JobStatus.processing,
      attempts: { increment: 1 },
      startedAt: new Date(),
    },
  });

  // 3. 更新できなかった = 他の Worker に先を越された。
  //    呼び出し側は次のループでまた別の Job を探せばよい
  if (claimed.count === 0) {
    return null;
  }

  // 4. 更新後の状態(増えた attempts を含む)を返す
  return await prisma.job.findUniqueOrThrow({ where: { id: candidate.id } });
}

// 成功。二度と実行されないよう completed にする
export async function completeJob(id: number): Promise<void> {
  await prisma.job.update({
    where: { id },
    data: {
      status: JobStatus.completed,
      completedAt: new Date(),
    },
  });
}

// 失敗。まだ試行回数が残っていれば pending に戻して再挑戦させ、
// 使い切っていれば dead にして諦める。
// 戻り値で「どちらの扱いになったか」を呼び出し側(Worker)に伝え、ログに出させる
export async function failJob(
  job: Job,
  error: unknown,
): Promise<"retry" | "dead"> {
  const message = error instanceof Error ? error.message : String(error);

  // attempts は claimNextJob で増加済みなので、ここでは増やさない(二重加算になる)
  if (job.attempts >= job.maxAttempts) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: JobStatus.dead, lastError: message },
    });
    return "dead";
  }

  await prisma.job.update({
    where: { id: job.id },
    data: {
      // pending に戻すことがリトライそのもの。
      // runAt を未来にすることで「すぐには拾わせない」を表現する
      status: JobStatus.pending,
      runAt: new Date(Date.now() + retryDelayMs(job.attempts)),
      lastError: message,
    },
  });
  return "retry";
}
