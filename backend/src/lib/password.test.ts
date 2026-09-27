import { beforeAll, describe, expect, test } from "vitest";
import { hashPassword, verifyPassword } from "./password.js";

describe("hashPassword / verifyPassword", () => {
  const password = "correct-horse-battery";
  let stored: string;

  // scrypt は総当たり対策でわざと計算を重くしてあるため、
  // ハッシュ化はこの describe 全体で1回だけ行い、各テストで使い回す
  beforeAll(async () => {
    stored = await hashPassword(password);
  });

  test("保存形式は scrypt$<salt 32桁>$<hash 128桁> になる", () => {
    expect(stored).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
  });

  test("正しいパスワードなら true", async () => {
    const ok = await verifyPassword(password, stored);

    expect(ok).toBe(true);
  });

  test("1文字だけ違うパスワードなら false", async () => {
    const ok = await verifyPassword("correct-horse-batterY", stored);

    expect(ok).toBe(false);
  });

  test("同じパスワードでもハッシュ化のたびに値が変わる(salt)", async () => {
    const another = await hashPassword(password);

    expect(another).not.toBe(stored);
    expect(await verifyPassword(password, another)).toBe(true);
  });

  // 保存値の無効クラス。壊れていても例外を投げず false を返す仕様
  test.each([
    { label: "空文字", broken: "" },
    { label: "アルゴリズム名が違う", broken: "bcrypt$00$00" },
    { label: "区切りが足りない", broken: "scrypt$abcd" },
  ])("保存値が壊れている($label)なら false", async ({ broken }) => {
    const ok = await verifyPassword(password, broken);

    expect(ok).toBe(false);
  });
});
