// tools/discover-channels.mjs
import { google } from "googleapis";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" }); // ← ここ追加

const yt = google.youtube({
  version: "v3",
  auth: process.env.YT_API_KEY, // .env.local にある値を読み込み
});

async function discoverChannels() {
  const queries = [
    "MADTOWN",
    "MADTOWN 切り抜き",
    "MAD TOWN",
    "マッドタウン",
    "まっどたうん",
  ];

  const channelMap = new Map();
  const MAX_PAGES = 5; // クォータ節約：5ページ = 約250動画/クエリ

  for (const query of queries) {
    console.log(`🔍 検索中: ${query}`);
    let nextPageToken = undefined;

    for (let page = 0; page < MAX_PAGES; page++) {
      const res = await yt.search.list({
        part: ["snippet"],
        q: query,
        type: ["video"],
        order: "date",
        maxResults: 50,
        regionCode: "JP",
        pageToken: nextPageToken,
      });

      res.data.items?.forEach((item) => {
        const id = item.snippet?.channelId;
        const title = item.snippet?.channelTitle;
        const videoTitle = item.snippet?.title || "";
        const description = item.snippet?.description || "";

        if (!id || !title) return;

        // 🧮 MADTOWN関連スコア
        let score = 1;
        const text = (videoTitle + " " + description).toLowerCase();

        if (text.includes("madtown")) score += 2;
        if (text.includes("マッドタウン")) score += 2;
        if (text.includes("切り抜き")) score += 1;
        if (text.includes("shorts") || text.includes("ショート")) score += 0.5;
        if (title.match(/(mad|town|切り抜き)/i)) score += 0.5;

        const existing = channelMap.get(id);
        if (existing) {
          existing.count += 1;
          existing.score += score;
        } else {
          channelMap.set(id, {
            id,
            name: title,
            count: 1,
            score,
          });
        }
      });

      nextPageToken = res.data.nextPageToken;
      if (!nextPageToken) break;
    }
  }

  // 🎯 スコア降順で上位チャンネル抽出
  const sorted = Array.from(channelMap.values())
    .sort((a, b) => b.score - a.score || b.count - a.count)
    .slice(0, 40);

  // JSON保存
  fs.writeFileSync("discovered_channels.json", JSON.stringify(sorted, null, 2));

  console.log("✅ 上位チャンネル一覧:");
  sorted.forEach((c, i) => {
    console.log(
      `${i + 1}. ${c.name} (${c.id}) - 動画数:${c.count}, スコア:${c.score.toFixed(
        1
      )}`
    );
  });

  console.log(`📦 合計検出チャンネル数: ${channelMap.size}`);
}

discoverChannels().catch((err) => console.error("❌ Error:", err));
