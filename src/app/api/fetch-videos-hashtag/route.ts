// src/app/api/fetch-videos-hashtag/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { logQuota } from "@/src/lib/logQuota";

export const runtime = "nodejs";

// 最大取得件数（1チャンネルあたり）
const MAX_RESULTS = 3;
// 取得対象期間（日数）
const DAYS_RANGE = 3;

export async function GET() {
  console.log("🔍 MADTOWN関連チャンネル限定での動画検索開始");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const keys = [
    process.env.YT_API_KEY,
    process.env.YT_API_KEY_BACKUP,
    process.env.YT_API_KEY_BACKUP_2,
  ].filter(Boolean) as string[];

  let yt = google.youtube({ version: "v3", auth: keys[0] });

  const trySearch = async (fn: () => Promise<any>) => {
    for (let i = 0; i < keys.length; i++) {
      try {
        yt = google.youtube({ version: "v3", auth: keys[i] });
        return await fn();
      } catch (e: any) {
        if (e.code === 403 && e.message?.includes("quota")) {
          console.warn(`⚠️ APIキー${i + 1}でquota超過、次のキーに切替`);
          continue;
        }
        throw e;
      }
    }
    throw new Error("すべてのAPIキーでquota制限に達しました。");
  };

  const now = new Date().toISOString();
  const publishedAfter = new Date(Date.now() - DAYS_RANGE * 86400 * 1000).toISOString();
  let totalInserted = 0;

  const parseDuration = (iso: string): number => {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || "0");
    const min = parseInt(m[2] || "0");
    const s = parseInt(m[3] || "0");
    return h * 3600 + min * 60 + s;
  };

  try {
    // 🎯 登録チャンネルを取得（activeなもののみ）
    const { data: channels, error: chErr } = await supabase
      .from("madtown_channels")
      .select("id, name")
      .eq("active", true);

    if (chErr) throw chErr;
    if (!channels?.length)
      throw new Error("有効なチャンネルが登録されていません。");

    console.log(`📡 対象チャンネル: ${channels.length}件`);

    for (const ch of channels) {
      console.log(`📺 チャンネル取得中: ${ch.name} (${ch.id})`);

      const searchRes = (await trySearch(() =>
        yt.search.list({
          part: ["id"],
          channelId: ch.id!,
          type: ["video"],
          order: "date",
          maxResults: MAX_RESULTS,
          publishedAfter,
        })
      )) as unknown as { data: youtube_v3.Schema$SearchListResponse };

      const ids = searchRes.data.items
        ?.map((v) => v.id?.videoId)
        .filter(Boolean) as string[];

      if (!ids?.length) continue;

      const statsRes = (await trySearch(() =>
        yt.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: ids,
        })
      )) as unknown as { data: youtube_v3.Schema$VideoListResponse };

      const videos =
        statsRes.data.items
          ?.filter((v) => {
            const dur = parseDuration(v.contentDetails?.duration || "");
            const live = v.snippet?.liveBroadcastContent;
            const title = v.snippet?.title?.toLowerCase() || "";
            return (
              dur > 0 &&
              dur <= 3600 &&
              live === "none" &&
              title.includes("madtown")
            );
          })
          .map((v) => ({
            id: v.id!,
            title: v.snippet?.title || "",
            channel_id: v.snippet?.channelId || "",
            channel_name: v.snippet?.channelTitle || "",
            view_count: parseInt(v.statistics?.viewCount || "0"),
            like_count: parseInt(v.statistics?.likeCount || "0"),
            published_at: v.snippet?.publishedAt,
            thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
            duration: v.contentDetails?.duration || "",
            season: "2025-10",
            updated_at: now,
          })) || [];

      if (!videos.length) continue;

      const { error: insertErr } = await supabase.from("videos").upsert(videos);
      if (insertErr) {
        console.error(`⚠️ ${ch.name} の登録中にエラー:`, insertErr.message);
        continue;
      }

      totalInserted += videos.length;
      console.log(`✅ ${ch.name}: ${videos.length}件追加 (累計 ${totalInserted})`);
    }

    await logQuota("fetch-videos-hashtag-lite", 15); // 🔻 クォータ節約記録

    console.log(`🎉 MADTOWN軽量タイトル検索完了: ${totalInserted}件`);
    return NextResponse.json({ ok: true, inserted: totalInserted });
  } catch (error: any) {
    console.error("❌ fetch-videos-hashtag-lite error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
