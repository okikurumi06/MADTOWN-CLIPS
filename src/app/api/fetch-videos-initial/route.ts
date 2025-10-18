// src/app/api/fetch-videos-initial/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const MAX_RESULTS = 50;

export async function GET() {
  try {
    const yt = google.youtube({
      version: "v3",
      auth: process.env.YT_API_KEY,
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const now = new Date().toISOString();

    // 🔄 UTC基準で9時間前にずらして日本時間10/1をカバー
    const publishedAfter = "2025-09-30T00:00:00Z";

    // 🔍 MADTOWN 関連キーワード（全角・括弧付き・英語・切り抜き・Shorts）
    const queries = [
      'MADTOWN',
      'ＭＡＤＴＯＷＮ',
      '"MADTOWN" 切り抜き',
      'MADTOWN Shorts',
      '【MADTOWN】',
    ];

    let totalInserted = 0;
    const seen = new Set<string>();

    console.log("📺 MADTOWN 初期全件取得開始...");

    // ⏱ ISO8601 → 秒数変換
    function parseDuration(iso: string): number {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    }

    for (const q of queries) {
      let nextPageToken: string | undefined = undefined;

      do {
        const searchRes = await yt.search.list({
          part: ["id"],
          q,
          type: ["video"],
          maxResults: MAX_RESULTS,
          order: "date",
          publishedAfter,
          pageToken: nextPageToken,
        });

        const ids = searchRes.data.items
          ?.map((v) => v.id?.videoId)
          .filter(Boolean)
          .filter((id) => !seen.has(id!));

        if (!ids?.length) break;
        ids.forEach((id) => seen.add(id!));

        // 🎯 詳細情報を取得
        const statsRes = await yt.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: ids.join(","),
        });

        const videos =
          statsRes.data.items
            ?.filter((v) => {
              const duration = v.contentDetails?.duration || "";
              const durationSec = parseDuration(duration);
              const liveState = v.snippet?.liveBroadcastContent;
              // 🎛️ ライブ中・1時間超え・0秒を除外
              return (
                duration &&
                durationSec > 0 &&
                durationSec <= 3660 && // わずかに緩めて61分まで許容
                liveState === "none"
              );
            })
            .map((v) => ({
              id: v.id!,
              title: v.snippet?.title || "",
              channel_name: v.snippet?.channelTitle || "",
              view_count: parseInt(v.statistics?.viewCount || "0"),
              like_count: parseInt(v.statistics?.likeCount || "0"),
              published_at: v.snippet?.publishedAt,
              thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
              duration: v.contentDetails?.duration || "",
              is_short_final: false,
              season: "2025-10",
              updated_at: now,
            })) || [];

        if (videos.length > 0) {
          const { error } = await supabase.from("videos").upsert(videos);
          if (error) throw error;
          totalInserted += videos.length;
          console.log(`✅ ${videos.length} 件を追加 (${totalInserted} 件累計)`);
        }

        nextPageToken = searchRes.data.nextPageToken;
      } while (nextPageToken);
    }

    console.log(`🎉 初期取得完了: ${totalInserted} 件`);
    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      timestamp: now,
    });
  } catch (error: any) {
    console.error("❌ fetch-videos-initial error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
