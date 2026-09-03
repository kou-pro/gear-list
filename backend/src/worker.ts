// .env を process.env に読み込む。prisma.ts が DATABASE_URL を、mail.ts が SMTP_* を
// 参照するため、他のどの import よりも先に評価される必要がある(必ず1行目に置く)
import "dotenv/config";
import { prisma } from "./lib/prisma.js";
import { sendVerificationEmail } from "./lib/mail.js";
import {
  claimNextJob,
  completeJob,
  failJob,
  retryDelayMs,
  type JobPayloads,
  type JobType,
  type QueueOrder,
} from "./lib/queue.js";
import { JobStatus, type Job } from "./generated/prisma/client.js";

// キューが空のときに次を見に行くまでの待ち時間。
// 短くすると反応が速くなるが DB への問い合わせが増える。
// 実務では PostgreSQL の LISTEN/NOTIFY で「積まれた瞬間に起こす」方式もある
const POLL_INTERVAL_MS = 1000;

// 取り出し順。既定は fifo(Queue)。QUEUE_ORDER=lifo で Stack の挙動を試せる
const order: QueueOrder = process.env.QUEUE_ORDER === "lifo" ? "lifo" : "fifo";

// Job の種別 → 実際の処理、の対応表。
// 種別が増えたらここに足す。型で「全種別を網羅していること」が強制される
const handlers: {
  [T in JobType]: (payload: JobPayloads[T]) => Promise<void>;
} = {
  send_verification_email: ({ to, token }) => sendVerificationEmail(to, token),
};

function log(message: string): void {
  console.log(`[worker] ${message}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 処理中に停止要求が来ても、その Job だけは最後まで終わらせてから止まる。
// 途中で殺すと「メールは送ったのに completed になっていない」状態が生まれ、
// 再起動後に同じメールをもう一度送ってしまう
let running = true;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, () => {
    log(`received ${signal}, finishing current job...`);
    running = false;
  });
}

async function processJob(job: Job): Promise<void> {
  log(
    `claimed job#${job.id} type=${job.type} attempt=${job.attempts}/${job.maxAttempts}`,
  );

  const handler = handlers[job.type as JobType];

  // 知らない種別はリトライしても直らない(コードを直さない限り永久に失敗する)ので、
  // 試行回数を消費させずに即 dead にする
  if (!handler) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        status: JobStatus.dead,
        lastError: `unknown job type: ${job.type}`,
      },
    });
    log(`dead job#${job.id}: unknown type ${job.type}`);
    return;
  }

  try {
    await handler(job.payload as JobPayloads[JobType]);
    await completeJob(job.id);
    log(`completed job#${job.id}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const outcome = await failJob(job, err);

    if (outcome === "retry") {
      log(
        `failed job#${job.id} attempt=${job.attempts}/${job.maxAttempts} → retry in ${retryDelayMs(job.attempts) / 1000}s: ${message}`,
      );
    } else {
      log(`dead job#${job.id} after ${job.attempts} attempts: ${message}`);
    }
  }
}

async function main(): Promise<void> {
  log(`started (order=${order})`);

  while (running) {
    const job = await claimNextJob(order);

    // 空なら少し待つ。あれば間を置かずに次の Job へ進む(溜まっている分を一気に捌く)
    if (!job) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }

    await processJob(job);
  }

  log("stopped");
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error("[worker] fatal:", err);
  await prisma.$disconnect();
  process.exit(1);
});
