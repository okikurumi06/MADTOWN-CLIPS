// src/app/api/fetch-videos-hashtag/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  console.log("🔍 MADTOWNハッシュタグ動画収集開始");

  const yt = google.youtube({
    version: "v3",
    auth: process.env.YT_API_KEY || process.env.YT_API_KEY_BACKUP,
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const now = new Date().toISOString();
  const query =
    "madtown OR マッドタウン OR #MADTOWN OR #マッドタウン OR madtown切り抜き";

  let totalInserted = 0;
  let nextPageToken: string | undefined;

  const parseDuration = (iso: string): number => {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || "0");
    const min = parseInt(m[2] || "0");
    const s = parseInt(m[3] || "0");
    return h * 3600 + min * 60 + s;
  };

  try {
    do {
      // 🎯 MADTOWN 関連タグを含む動画を検索
      const searchRes = (await yt.search.list({
        part: ["id"],
        q: query,
        type: ["video"],
        order: "date",
        maxResults: 25,
        pageToken: nextPageToken,
        publishedAfter: "2025-10-01T00:00:00Z", // 最近のみに限定
      })) as unknown as { data: youtube_v3.Schema$SearchListResponse };

      const ids =
        searchRes.data.items
          ?.map((v) => v.id?.videoId)
          .filter(Boolean) as string[];

      if (!ids?.length) break;

      // 詳細取得
      const statsRes = (await yt.videos.list({
        part: ["snippet", "statistics", "contentDetails"],
        id: ids,
      })) as unknown as { data: youtube_v3.Schema$VideoListResponse };

      const videos =
        statsRes.data.items
          ?.filter((v) => {
            const dur = parseDuration(v.contentDetails?.duration || "");
            return dur > 0 && dur <= 3600 && v.snippet?.liveBroadcastContent === "none";
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
        console.log(`✅ ${videos.length} 件追加 (${totalInserted} 件累計)`);
      }

      nextPageToken = searchRes.data.nextPageToken ?? undefined;
    } while (nextPageToken);

    console.log(`🎉 MADTOWNハッシュタグ収集完了: ${totalInserted}件`);
    return NextResponse.json({ ok: true, inserted: totalInserted });
  } catch (error: any) {
    console.error("❌ fetch-videos-hashtag error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
