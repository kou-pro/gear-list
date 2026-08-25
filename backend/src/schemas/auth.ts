import * as z from "zod";

// パスワードの長さ制限。
// 下限8文字は総当たりへの最低限の抵抗、上限128文字は DoS 対策。
// scrypt は入力長に比例して計算量が増えるため、巨大な文字列を送りつけられると
// サーバーの CPU を占有されてしまう(bcrypt と違い scrypt 自体に長さ上限が無い)
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;

// email と password の定義は signup / login で共通なので切り出す。
// ただしスキーマ自体は分けておく(将来 signup にだけ規約同意などが増える可能性があるため)
// 先に .trim() で前後の空白を落としてから形式を検証する。
// 逆順にすると "  a@b.com  " が形式エラーになり、コピペ入力で弾かれてしまう。
// z.email() は Zod v4 のトップレベル関数(v3 の z.string().email() は古い書き方)
const emailField = z
  .string("メールアドレスは文字列で指定してください")
  .trim()
  .pipe(z.email("メールアドレスの形式が正しくありません"));

const passwordField = z
  .string("パスワードは文字列で指定してください")
  // パスワードに .trim() は付けない。
  // 前後の空白も利用者が意図して入力した文字の一部であり、
  // 登録時と入力時で扱いが変わると「正しいのにログインできない」事故になる
  .min(PASSWORD_MIN, `パスワードは${PASSWORD_MIN}文字以上で入力してください`)
  .max(PASSWORD_MAX, `パスワードは${PASSWORD_MAX}文字以下で入力してください`);

// POST /api/auth/signup のリクエストボディ
export const signupSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type SignupInput = z.infer<typeof signupSchema>;

// POST /api/auth/login のリクエストボディ。
// 検証内容は signup と同じだが、ログイン時は「登録済みの値」を受け取るだけなので
// 将来 signup 側にだけ制約が増えても影響しないよう別スキーマにしている
export const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});

export type LoginInput = z.infer<typeof loginSchema>;
