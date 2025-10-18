// check_youtube_video.mjs
import { google } from "googleapis";

const API_KEY = "AIzaSyCAE-P0yYDbd7M-ATbbD_9KjUahBCnmwLA"; // ← 一時的に直接指定

async function main() {
  const yt = google.youtube({
    version: "v3",
    auth: API_KEY, // ここが重要！
  });

  const res = await yt.videos.list({
    part: ["snippet", "contentDetails"],
    id: "qpKziVjXvQg",
  });

  const video = res.data.items?.[0];
  if (!video) {
    console.log("❌ 動画が見つかりませんでした。");
    return;
  }

  console.log("🎬 タイトル:", video.snippet?.title);
  console.log("⏱ duration:", video.contentDetails?.duration);
  console.log("🖼 サムネイル情報:", video.snippet?.thumbnails?.medium);
}

main().catch(console.error);
