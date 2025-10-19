// src/app/api/fetch-videos-diff/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { logQuota } from "@/src/lib/logQuota";

export const runtime = "nodejs";
const MAX_RESULTS = 5;
const ACTIVE_WITHIN_DAYS = 14;

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

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

    const since = new Date();
    since.setDate(since.getDate() - ACTIVE_WITHIN_DAYS);

    const { data: channels, error: chError } = await supabase
      .from("madtown_channels")
      .select("id, name, last_checked")
      .eq("active", true)
      .or(`last_checked.is.null,last_checked.gt.${since.toISOString()}`);

    if (chError) throw chError;
    if (!channels?.length) throw new Error("最近アクティブなチャンネルがありません。");

    console.log(`📡 対象チャンネル: ${channels.length} 件`);

    let totalInserted = 0;

    const parseDuration = (iso: string): number => {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    };

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
          if (e.code === 403 && e.message.includes("quota")) {
            console.warn(`⚠️ APIキー${i + 1}でquota超過、次のキーに切替`);
            continue;
          }
          throw e;
        }
      }
      throw new Error("すべてのAPIキーでquota制限に達しました。");
    };

    for (const ch of channels) {
      console.log(`📡 チャンネル取得中: ${ch.name} (${ch.id})`);

      const searchRes = await trySearch(() =>
        yt.search.list({
          part: ["id"],
          channelId: ch.id!,
          type: ["video"],
          maxResults: MAX_RESULTS,
          order: "date",
          publishedAfter,
        })
      );

      const ids = searchRes.data.items
        ?.map((v: any) => v.id?.videoId)
        .filter(Boolean) as string[];

      if (!ids?.length) continue;

      const statsRes = await trySearch(() =>
        yt.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: ids,
        })
      );

      // 🎯 MADTOWN 関連タイトルのみ抽出
      const videos =
        statsRes.data.items
          ?.filter((v: any) => {
            const title = v.snippet?.title?.toLowerCase() || "";
            const duration = v.contentDetails?.duration || "";
            const durationSec = parseDuration(duration);
            const liveState = v.snippet?.liveBroadcastContent;

            // 🟣 タイトルに "madtown" が含まれることが必須
            return (
              title.includes("madtown") &&
              durationSec > 0 &&
              durationSec <= 3600 &&
              liveState === "none"
            );
          })
          .map((v: any) => ({
            id: v.id!,
            title: v.snippet?.title || "",
            channel_name: v.snippet?.channelTitle || "",
            view_count: parseInt(v.statistics?.viewCount || "0"),
            like_count: parseInt(v.statistics?.likeCount || "0"),
            published_at: v.snippet?.publishedAt,
            thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
            duration: v.contentDetails?.duration || "",
            season: "2025-10",
            updated_at: now,
          })) || [];

      if (videos.length > 0) {
        const { error } = await supabase.from("videos").upsert(videos);
        if (error) throw error;
        totalInserted += videos.length;
        console.log(`✅ ${ch.name}: ${videos.length} 件追加 (${totalInserted} 累計)`);

        await supabase
          .from("madtown_channels")
          .update({ last_checked: now })
          .eq("id", ch.id);
      }
    }

    console.log(`🎉 差分取得完了: ${totalInserted} 件`);
    await logQuota("fetch-videos-diff", 50);

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      since: publishedAfter,
      timestamp: now,
    });
  } catch (error: any) {
    console.error("❌ fetch-videos-diff error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
