import nodemailer from "nodemailer";

// SMTP クライアント(トランスポーター)。
// 開発環境では docker-compose の Mailpit(localhost:1025)に向いており、
// 実際のメールは外部へ送信されず http://localhost:8025 で確認できる。
// 本番でも接続先の環境変数を差し替えるだけで同じコードが動く
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST ?? "localhost",
  port: Number(process.env.SMTP_PORT ?? 1025),
  // Mailpit は TLS なしの平文 SMTP。本番で外部サービスを使う場合は要変更
  secure: false,
});

const MAIL_FROM = process.env.MAIL_FROM ?? "Gear List <noreply@gearlist.local>";
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

// メールアドレス確認メールを送る。
// リンクにトークンを載せる = 「このリンクを開けた人はメールの持ち主」とみなせる
// (トークンはメールを受信できた人しか知りえないため)
export async function sendVerificationEmail(
  to: string,
  token: string,
): Promise<void> {
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: "【Gear List】メールアドレスの確認",
    // text と html の両方を用意する。html を表示できない環境では text が使われる
    text: [
      "Gear List にご登録ありがとうございます。",
      "",
      "以下のリンクを開いて、メールアドレスの確認を完了してください。",
      verifyUrl,
      "",
      "このリンクの有効期限は24時間です。",
      "心当たりがない場合は、このメールを無視してください。",
    ].join("\n"),
    html: [
      "<p>Gear List にご登録ありがとうございます。</p>",
      "<p>以下のリンクを開いて、メールアドレスの確認を完了してください。</p>",
      `<p><a href="${verifyUrl}">メールアドレスを確認する</a></p>`,
      "<p>このリンクの有効期限は24時間です。<br>",
      "心当たりがない場合は、このメールを無視してください。</p>",
    ].join("\n"),
  });
}
