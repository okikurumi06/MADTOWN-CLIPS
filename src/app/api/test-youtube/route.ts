//app/api/test-youtube/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

export const runtime = "nodejs"; // ← Vercelなどサーバーサイドで実行

export async function GET() {
  try {
    // ✅ YouTube APIクライアント初期化
    const yt = google.youtube({
      version: "v3",
      auth: process.env.YT_API_KEY, // ← .env.local で設定したキー
    });

    // ✅ 「MADTOWN 切り抜き」で検索（最新5件）
    const response = await yt.search.list({
      part: ["id", "snippet"],
      q: "MADTOWN 切り抜き",
      type: ["video"],
      maxResults: 5,
      order: "date",
    });

    const results =
      response.data.items?.map((v) => ({
        id: v.id?.videoId,
        title: v.snippet?.title,
        channel: v.snippet?.channelTitle,
        publishedAt: v.snippet?.publishedAt,
      })) || [];

    // ✅ 結果をJSONで返す
    return NextResponse.json({
      ok: true,
      count: results.length,
      results,
    });
  } catch (error: any) {
    console.error("❌ YouTube API error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
