// src/app/api/fetch-videos/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    // ✅ YouTube API 初期化
    const yt = google.youtube({
      version: "v3",
      auth: process.env.YT_API_KEY,
    });

    // ✅ Supabase 初期化
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ✅ 検索キーワードは "MADTOWN" 固定。ただし複数回検索で補足範囲を広げる
    const queries = [
      "MADTOWN",
      "MADTOWN 切り抜き",
      "MADTOWN Shorts",
    ];

    const allVideos: any[] = [];
    const now = new Date().toISOString();

    // ⏱ ISO8601 → 秒数変換ユーティリティ
    function parseDuration(iso: string): number {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    }

    // 🧭 検索実行（複数クエリで重複排除）
    const seen = new Set<string>();

    for (const q of queries) {
      const searchRes = await yt.search.list({
        part: ["id", "snippet"],
        q,
        type: ["video"],
        maxResults: 50,
        order: "date",
        publishedAfter: "2025-10-01T00:00:00Z",
      });

      const ids = searchRes.data.items
        ?.map((v) => v.id?.videoId)
        .filter(Boolean)
        .filter((id) => !seen.has(id!));

      if (!ids?.length) continue;
      ids.forEach((id) => seen.add(id!));

      // 詳細情報を取得
      const statsRes = await yt.videos.list({
        part: ["statistics", "snippet", "contentDetails"],
        id: ids.join(","),
      });

      const videos =
        statsRes.data.items
          ?.map((v) => {
            const durationSec = parseDuration(v.contentDetails?.duration || "PT0S");

            // ⛔ 長尺動画は除外（>1時間）
            if (durationSec > 3600) return null;

            return {
              id: v.id!,
              title: v.snippet?.title || "",
              channel_name: v.snippet?.channelTitle || "",
              view_count: parseInt(v.statistics?.viewCount || "0"),
              like_count: parseInt(v.statistics?.likeCount || "0"),
              published_at: v.snippet?.publishedAt,
              thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
              duration: v.contentDetails?.duration || "PT0S",
              season: "2025-10",
              updated_at: now,
            };
          })
          .filter(Boolean) || [];

      allVideos.push(...videos);
    }

    if (allVideos.length === 0) {
      return NextResponse.json({ ok: false, message: "No valid videos found" });
    }

    // 💾 Supabase UPSERT
    const { error } = await supabase.from("videos").upsert(allVideos);
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      updated: allVideos.length,
      timestamp: now,
    });
  } catch (error: any) {
    console.error("❌ fetch-videos error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
