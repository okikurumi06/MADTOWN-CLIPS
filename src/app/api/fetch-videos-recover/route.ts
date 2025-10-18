// src/app/api/fetch-videos-recover/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const MAX_RESULTS = 25;

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

    const publishedAfter = "2025-10-01T00:00:00Z";
    const now = new Date().toISOString();

    console.log(`📺 MADTOWN 再スキャン開始: ${publishedAfter} 〜 ${now}`);

    const { data: channels, error: chError } = await supabase
      .from("madtown_channels")
      .select("id, name")
      .eq("active", true);

    if (chError) throw chError;
    if (!channels?.length) throw new Error("チャンネルが登録されていません");

    function parseDuration(iso?: string): number {
      if (!iso) return 0;
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      return (
        (parseInt(m[1] || "0") * 3600) +
        (parseInt(m[2] || "0") * 60) +
        parseInt(m[3] || "0")
      );
    }

    let totalInserted = 0;

    for (const ch of channels) {
      console.log(`📡 ${ch.name} の動画を取得中...`);

      let nextPageToken: string | undefined;
      const collectedIds = new Set<string>(); // ← 重複防止

      do {
        const searchRes = await yt.search.list({
          part: ["id"],
          channelId: ch.id,
          type: ["video"],
          maxResults: MAX_RESULTS,
          order: "date",
          publishedAfter,
          pageToken: nextPageToken,
        });

        const ids =
          searchRes.data.items
            ?.map((v) => v.id?.videoId)
            .filter(Boolean) || [];

        ids.forEach((id) => collectedIds.add(id!)); // ← Setに追加（重複防止）
        nextPageToken = searchRes.data.nextPageToken;
      } while (nextPageToken);

      const idArray = Array.from(collectedIds);
      if (idArray.length === 0) continue;

      console.log(`🔎 ${ch.name}: ${idArray.length}件の動画を取得`);

      const statsRes = await yt.videos.list({
        part: ["snippet", "statistics", "contentDetails"],
        id: idArray.join(","),
      });

      const videos =
        statsRes.data.items
          ?.map((v) => {
            const duration = v.contentDetails?.duration || "";
            const durationSec = parseDuration(duration);
            const liveState = v.snippet?.liveBroadcastContent;
            const title = v.snippet?.title || "";

            if (
              !/MADTOWN/i.test(title) ||
              durationSec > 3600 ||
              liveState !== "none"
            )
              return null;

            return {
              id: v.id!,
              title,
              channel_name: v.snippet?.channelTitle || "",
              view_count: parseInt(v.statistics?.viewCount || "0"),
              like_count: parseInt(v.statistics?.likeCount || "0"),
              published_at: v.snippet?.publishedAt,
              thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
              duration,
              is_short_final: false,
              season: "2025-10",
              updated_at: now,
            };
          })
          .filter(Boolean) || [];

      if (videos.length > 0) {
        // 🔹 Supabaseは一度に同じIDがあると衝突するため、明示的に重複除去
        const uniqueVideos = Array.from(
          new Map(videos.map((v) => [v.id, v])).values()
        );

        const { error } = await supabase.from("videos").upsert(uniqueVideos);
        if (error) throw error;

        totalInserted += uniqueVideos.length;
        console.log(`✅ ${ch.name}: ${uniqueVideos.length} 件追加`);
      }
    }

    console.log(`🎉 再スキャン完了: ${totalInserted} 件`);
    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      from: publishedAfter,
      timestamp: now,
    });
  } catch (error: any) {
    console.error("❌ fetch-videos-recover error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
