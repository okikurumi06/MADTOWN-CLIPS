// src/app/api/fetch-videos/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const MAX_RESULTS = 25;

export async function GET() {
  try {
    const yt = google.youtube({
      version: "v3",
      auth: process.env.YT_API_KEY || process.env.YT_API_KEY_BACKUP,
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🎥 チャンネル一覧を取得
    const { data: channels, error: chError } = await supabase
      .from("madtown_channels")
      .select("id, name")
      .eq("active", true);

    if (chError) throw chError;
    if (!channels?.length) throw new Error("有効なチャンネルが存在しません。");

    console.log(`📡 対象チャンネル: ${channels.length} 件`);

    const now = new Date().toISOString();
    let totalInserted = 0;

    const parseDuration = (iso: string): number => {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    };

    for (const ch of channels) {
      console.log(`🎬 チャンネル処理中: ${ch.name} (${ch.id})`);
      let nextPageToken: string | undefined = undefined;

      do {
        const searchRes = (await yt.search.list({
          part: ["id"],
          channelId: ch.id!,
          type: ["video"],
          maxResults: MAX_RESULTS,
          order: "date",
          pageToken: nextPageToken,
        })) as unknown as { data: youtube_v3.Schema$SearchListResponse };

        const ids =
          searchRes.data.items
            ?.map((v) => v.id?.videoId)
            .filter(Boolean) as string[];

        if (!ids?.length) break;

        // ✅ 修正点：`id` を string ではなく string[] で渡す
        const statsRes = (await yt.videos.list({
          part: ["statistics", "snippet", "contentDetails"],
          id: ids, // ← join(",")ではなく配列として渡す
        })) as unknown as { data: youtube_v3.Schema$VideoListResponse };

        const videos =
          statsRes.data.items
            ?.filter((v) => {
              const duration = v.contentDetails?.duration || "";
              const durationSec = parseDuration(duration);
              const liveState = v.snippet?.liveBroadcastContent;
              return (
                durationSec > 0 &&
                durationSec <= 3600 &&
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
          console.log(`✅ ${ch.name}: ${videos.length} 件追加 (${totalInserted} 件累計)`);
        }

        nextPageToken = searchRes.data.nextPageToken ?? undefined;
      } while (nextPageToken);
    }

    console.log(`🎉 fetch-videos 完了: ${totalInserted} 件`);
    return NextResponse.json({ ok: true, inserted: totalInserted });
  } catch (error: any) {
    console.error("❌ fetch-videos error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
