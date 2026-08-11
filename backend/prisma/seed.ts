// DATABASE_URL を読むために必要(index.ts と同じ理由で先頭に置く)
import "dotenv/config";
import { prisma } from "../src/lib/prisma.js";

async function main() {
  // ── 何度実行しても同じ結果になるよう、先に全消しする(冪等性の確保) ──
  // GearItem を消すコードは不要: GearList の削除に onDelete: Cascade が連動するため
  await prisma.gearList.deleteMany();

  // ── リスト + 所属アイテムを nested write で一括作成 ──
  await prisma.gearList.create({
    data: {
      title: "夏山日帰り",
      description: "無雪期の日帰り登山を想定",
      items: {
        create: [
          // 身につけるもの(頭から足元へ)
          { name: "ヘルメット", quantity: 1 },
          { name: "ヘルメットインナー", quantity: 1 },
          { name: "山用下着(ベースレイヤー)", quantity: 1 },
          { name: "山シャツ", quantity: 1 },
          { name: "登山用パンツ", quantity: 1 },
          { name: "登山靴", quantity: 1 },
          { name: "ゲイター", quantity: 1 },
          // ザックと中身
          { name: "ザック", quantity: 1 },
          { name: "レインウェア", quantity: 1 },
          { name: "ストック", quantity: 2 },
          { name: "飲料水(1L)", quantity: 2 },
          { name: "行動食", quantity: 1 },
          { name: "ヘッドランプ", quantity: 1 },
          { name: "予備電池・予備バッテリー", quantity: 1 },
          { name: "ファーストエイドキット", quantity: 1 },
          { name: "地図・コンパス", quantity: 1 },
          { name: "GPS", quantity: 1 },
          { name: "ホイッスル", quantity: 1 },
          { name: "日焼け止め", quantity: 1 },
          { name: "虫除けスプレー", quantity: 1 },
          { name: "携帯トイレ", quantity: 1 },
        ],
      },
    },
  });

  await prisma.gearList.create({
    data: {
      title: "冬山日帰り",
      description: "積雪期の日帰り登山を想定",
      items: {
        create: [
          // 身につけるもの(頭から足元へ)
          { name: "ヘルメット", quantity: 1 },
          { name: "バラクラバ", quantity: 1 },
          { name: "山用下着(ベースレイヤー)", quantity: 1 },
          { name: "山シャツ", quantity: 1 },
          { name: "プラブーツ/スキーブーツ", quantity: 1 },
          // 手袋(重ね着で使い分ける)
          { name: "インナー手袋", quantity: 1 },
          { name: "ゴム手袋", quantity: 1 },
          { name: "オーバーグローブ", quantity: 1 },
          { name: "防寒テムレス", quantity: 1 },
          // 行動用具
          { name: "スキー", quantity: 1 },
          { name: "スキーシール", quantity: 1 },
          { name: "ストック", quantity: 2 },
          { name: "アイゼン", quantity: 1 },
          { name: "スノーシュー", quantity: 1 },
          { name: "ピッケル", quantity: 1 },
          // ザックの中
          { name: "レインウェア", quantity: 1 },
          { name: "ヘッドランプ", quantity: 1 },
          { name: "ビーコン", quantity: 1 },
          { name: "ツェルト", quantity: 1 },
          { name: "テルモス(お湯)", quantity: 1 },
        ],
      },
    },
  });

  console.log("シードデータの投入が完了しました");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1); // 失敗を終了コードで伝える(CI等で検知できるように)
  })
  .finally(() => prisma.$disconnect());
