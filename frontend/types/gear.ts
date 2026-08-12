// バックエンド(Hono + Prisma)が返す JSON の形をそのまま TypeScript の型にしたもの。
// schema.prisma のモデル定義と1対1で対応させる。

export type GearItem = {
  id: number;
  name: string;
  quantity: number;
  checked: boolean;
  // Prisma の DateTime は JSON になると ISO 文字列で届く(例: "2026-08-11T08:19:54.340Z")
  createdAt: string;
  updatedAt: string;
  // 所属するリストの id。外部キーがそのままレスポンスに含まれる
  gearListId: number;
};

export type GearList = {
  id: number;
  title: string;
  // schema.prisma が String?(NULL 可)なので、キーは必ず存在し値が null になりうる
  description: string | null;
  createdAt: string;
  updatedAt: string;
  // GET /api/lists には含まれず、GET /api/lists/:id(include: items)にだけ含まれる。
  // 「キーごと存在しない」ことがあるので ? を付ける
  items?: GearItem[];
};
