// src/app/api/fetch-videos-diff/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis"; // ← 型を明示的に読み込み
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const MAX_RESULTS = 25; // クォータ節約

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

    // 📅 Supabaseから最新投稿日を取得
    const { data: latest, error: latestError } = await supabase
      .from("videos")
      .select("published_at")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;

    const publishedAfter = latest?.published_at || "2025-10-01T00:00:00Z";
    const now = new Date().toISOString();
    console.log(`📺 差分取得開始: ${publishedAfter} 以降`);

    // 🧭 有効チャンネルを取得
    const { data: channels, error: chError } = await supabase
      .from("madtown_channels")
      .select("id, name")
      .eq("active", true);

    if (chError) throw chError;
    if (!channels?.length)
      throw new Error("有効なチャンネルが登録されていません。");

    console.log(`📡 対象チャンネル: ${channels.length} 件`);

    let totalInserted = 0;

    // ⏱ ISO8601 → 秒変換
    const parseDuration = (iso: string): number => {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    };

    // 🎥 各チャンネルの新着動画を取得
    for (const ch of channels) {
      let nextPageToken: string | undefined = undefined;
      console.log(`📡 チャンネル取得中: ${ch.name} (${ch.id})`);

      while (true) {
        // 👇 型を明示してビルド通過
        const searchRes: youtube_v3.Schema$SearchListResponse =
          await yt.search.list({
            part: ["id"],
            channelId: ch.id!,
            type: ["video"],
            maxResults: MAX_RESULTS,
            order: "date",
            publishedAfter,
            pageToken: nextPageToken,
          });

        const ids =
          searchRes.data.items
            ?.map((v) => v.id?.videoId)
            .filter(Boolean) as string[];

        if (!ids?.length) break;

        // 🎯 詳細情報取得
        const statsRes: youtube_v3.Schema$VideoListResponse =
          await yt.videos.list({
            part: ["snippet", "statistics", "contentDetails"],
            id: ids, // ✅ joinを削除し配列のまま渡す
          });

        const videos =
          statsRes.data.items
            ?.filter((v) => {
              const duration = v.contentDetails?.duration || "";
              const durationSec = parseDuration(duration);
              const liveState = v.snippet?.liveBroadcastContent;

              // 🎛️ ライブ・1時間超え除外
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
          console.log(
            `✅ ${ch.name}: ${videos.length} 件追加 (${totalInserted} 件累計)`
          );
        }

        nextPageToken = searchRes.data.nextPageToken;
        if (!nextPageToken) break;
      }
    }

    console.log(`🎉 差分取得完了: ${totalInserted} 件`);
    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      since: publishedAfter,
      timestamp: now,
    });
  } catch (error: any) {
    console.error("❌ fetch-videos-diff error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
