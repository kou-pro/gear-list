import {
  randomBytes,
  scrypt,
  timingSafeEqual,
  type ScryptOptions,
} from "node:crypto";

// scrypt はコールバック形式なので、await で書けるよう Promise 化する。
// 同期版(scryptSync)もあるが、計算に時間がかかる処理なので
// Node のイベントループを止めない非同期版を使う。
// util.promisify はオーバーロードされた関数の型をうまく推論できないため、
// options 付きのシグネチャに合わせて自前で包む
function scryptAsync(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

// OWASP Password Storage Cheat Sheet の推奨値(2026-08 時点)
// N = 2^17 = 131072, r = 8, p = 1
const N = 131072;
const R = 8;
const P = 1;
// scrypt は約 N * r * 128 バイトのメモリを使う。
// 131072 * 8 * 128 = 約 134MB なので、既定の maxmem(32MB)では足りず明示的に引き上げる
const MAX_MEM = 256 * 1024 * 1024;

const SALT_BYTES = 16;
const KEY_BYTES = 64;

// 保存形式: scrypt$<salt hex>$<hash hex>
// アルゴリズム名を先頭に持たせておくと、将来 Argon2 などへ移行するとき
// 「この行はどちらでハッシュ化されたか」を判別できる
const ALGORITHM = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  // salt はユーザーごとに毎回新しく生成する。
  // これがないと、同じパスワードの利用者が全員同じハッシュ値になり、
  // 事前計算した対応表(レインボーテーブル)で一括で破られてしまう
  const salt = randomBytes(SALT_BYTES);

  const hash = await scryptAsync(password, salt, KEY_BYTES, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });

  return `${ALGORITHM}$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [algorithm, saltHex, hashHex] = stored.split("$");

  // 保存値が壊れている場合は、例外を投げずに「不一致」として扱う。
  // ここで throw すると 500 になり、攻撃者に内部状態のヒントを与えてしまう
  if (algorithm !== ALGORITHM || !saltHex || !hashHex) {
    return false;
  }

  const salt = Buffer.from(saltHex, "hex");
  const storedHash = Buffer.from(hashHex, "hex");

  const inputHash = await scryptAsync(password, salt, storedHash.length, {
    N,
    r: R,
    p: P,
    maxmem: MAX_MEM,
  });

  // timingSafeEqual は長さが違うと例外を投げる仕様のため、先に長さを確認する
  if (inputHash.length !== storedHash.length) {
    return false;
  }

  // === で比較しないのは、先頭から順に比べて違った時点で処理が終わるため。
  // 一致した文字数が処理時間に現れ、それを何度も測ると1文字ずつ正解を割り出せてしまう
  // (タイミング攻撃)。timingSafeEqual は常に一定時間で比較する
  return timingSafeEqual(inputHash, storedHash);
}
