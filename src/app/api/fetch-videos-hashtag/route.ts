// src/app/api/fetch-videos-hashtag/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { logQuota } from "@/src/lib/logQuota";

export const runtime = "nodejs";

// 🎯 設定
const MAX_RESULTS = 3;   // 各チャンネルの取得件数
const DAYS_RANGE = 3;    // 3日以内の動画のみ

export async function GET() {
  console.log("🔍 MADTOWN関連チャンネルのアップロード動画をplaylistItems経由で取得開始");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 🔑 YouTube APIキー（フェイルオーバー）
  const keys = [
    process.env.YT_API_KEY4,
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

  try {
    const now = new Date().toISOString();
    const publishedAfter = new Date(Date.now() - DAYS_RANGE * 86400 * 1000).toISOString();
    let totalInserted = 0;

    // 🧠 秒数変換関数
    const parseDuration = (iso: string): number => {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    };

    // 📡 activeチャンネル取得（uploads_playlist_idあり）
    const { data: channels, error: chErr } = await supabase
      .from("madtown_channels")
      .select("id, name, uploads_playlist_id")
      .eq("active", true)
      .not("uploads_playlist_id", "is", null);

    if (chErr) throw chErr;
    if (!channels?.length) throw new Error("uploads_playlist_idが設定されたチャンネルがありません。");

    console.log(`📡 対象チャンネル: ${channels.length}件`);

    for (const ch of channels) {
      console.log(`📺 チャンネル取得中: ${ch.name}`);

      const playlistId = ch.uploads_playlist_id;
      // ❌ playlistIdが存在しない or 無効形式（"UU"で始まらない）ものをスキップ
      if (!playlistId || !playlistId.startsWith("UU")) {
        console.warn(`⚠️ 無効なplaylistIdをスキップ: ${ch.name} (${playlistId})`);
        continue;
      }

      // 🎞️ アップロード動画リストを取得
      const playlistRes = (await trySearch(() =>
        yt.playlistItems.list({
          part: ["contentDetails"],
          playlistId,
          maxResults: MAX_RESULTS,
        })
      )) as unknown as { data: youtube_v3.Schema$PlaylistItemListResponse };

      const ids = playlistRes.data.items
        ?.map((v) => v.contentDetails?.videoId)
        .filter(Boolean) as string[];

      if (!ids?.length) continue;

      // 📊 詳細取得
      const statsRes = (await trySearch(() =>
        yt.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: ids,
        })
      )) as unknown as { data: youtube_v3.Schema$VideoListResponse };

      const videos =
        statsRes.data.items
          ?.filter((v) => {
            const title = v.snippet?.title?.toLowerCase() || "";
            const dur = parseDuration(v.contentDetails?.duration || "");
            const live = v.snippet?.liveBroadcastContent;
            const published = v.snippet?.publishedAt || "";
            return (
              title.includes("madtown") &&
              dur > 0 &&
              dur <= 3600 &&
              live === "none" &&
              published > publishedAfter
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

    await logQuota("fetch-videos-hashtag-playlist", 10);
    console.log(`🎉 playlistItems版 hashtag 取得完了: ${totalInserted}件`);
    return NextResponse.json({ ok: true, inserted: totalInserted });
  } catch (error: any) {
    console.error("❌ fetch-videos-hashtag-playlist error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
