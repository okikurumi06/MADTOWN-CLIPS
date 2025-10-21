// src/app/api/fetch-videos-diff2/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { logQuota } from "@/src/lib/logQuota";

// Node.jsランタイムで実行
export const runtime = "nodejs";

// 🎯 上位チャンネルのみに特化した軽量版
const MAX_RESULTS = 5;           // 各チャンネルで取得する動画数
const ACTIVE_WITHIN_DAYS = 2;    // アクティブ期間の制限

export async function GET() {
  try {
    // 🔑 Supabaseクライアントを初期化
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🕒 最新の動画日付を取得（差分更新用）
    const { data: latest, error: latestError } = await supabase
      .from("videos")
      .select("published_at")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;
    const publishedAfter = latest?.published_at || "2025-10-01T00:00:00Z";
    const now = new Date().toISOString();

    console.log(`📺 fetch-videos-diff2: ${publishedAfter} 以降の新着動画を取得開始`);

    // 🕐 最近アクティブなチャンネル（2日以内）に限定
    const since = new Date();
    since.setDate(since.getDate() - ACTIVE_WITHIN_DAYS);

    // 🎯 madtown_channels から video_count順に上位30件を取得
    const { data: channels, error: chError } = await supabase
      .from("madtown_channels")
      .select("id, name, last_checked")
      .eq("active", true)
      .order("video_count", { ascending: false })
      .limit(30);

    if (chError) throw chError;
    if (!channels?.length) throw new Error("アクティブなチャンネルが見つかりません。");

    console.log(`📡 対象チャンネル数: ${channels.length}`);

    let totalInserted = 0;

    // ⏱ ISO8601 Duration → 秒数変換関数
    const parseDuration = (iso: string): number => {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    };

    // 🔑 APIキーをフェイルオーバー設定
    const keys = [
      process.env.YT_API_KEY,
      process.env.YT_API_KEY_BACKUP,
      process.env.YT_API_KEY_BACKUP_2,
    ].filter(Boolean) as string[];

    let yt = google.youtube({ version: "v3", auth: keys[0] });

    // 🚨 quota超過時に自動切替
    const trySearch = async (fn: () => Promise<any>) => {
      for (let i = 0; i < keys.length; i++) {
        try {
          yt = google.youtube({ version: "v3", auth: keys[i] });
          return await fn();
        } catch (e: any) {
          if (e.code === 403 && e.message.includes("quota")) {
            console.warn(`⚠️ APIキー${i + 1}がquota超過、次のキーへ`);
            continue;
          }
          throw e;
        }
      }
      throw new Error("すべてのAPIキーでquota制限に達しました。");
    };

    // 🔁 各チャンネルごとに新着動画を取得
    for (const ch of channels) {
      console.log(`🎬 チャンネル処理中: ${ch.name} (${ch.id})`);

      // 📡 新着動画を検索
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

      // 📊 各動画の詳細を取得
      const statsRes = await trySearch(() =>
        yt.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: ids,
        })
      );

      // 🎯 MADTOWN関連タイトルを抽出
      const videos =
        statsRes.data.items
          ?.filter((v: any) => {
            const title = v.snippet?.title?.toLowerCase() || "";
            const duration = v.contentDetails?.duration || "";
            const durationSec = parseDuration(duration);
            const liveState = v.snippet?.liveBroadcastContent;

            // 「madtown」キーワードを含み、1時間以内の通常動画のみ
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

      if (videos.length > 0) {
        // 📥 SupabaseにUPSERT
        const { error } = await supabase.from("videos").upsert(videos);
        if (error) throw error;

        totalInserted += videos.length;
        console.log(`✅ ${ch.name}: ${videos.length}件追加（累計${totalInserted}件）`);

        // チャンネルの最終チェック日時を更新
        await supabase
          .from("madtown_channels")
          .update({ last_checked: now })
          .eq("id", ch.id);
      }
    }

    // 📊 クォータログ登録
    await logQuota("fetch-videos-diff2", 50);

    console.log(`🎉 fetch-videos-diff2 完了: ${totalInserted}件を追加`);
    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      since: publishedAfter,
      timestamp: now,
    });
  } catch (error: any) {
    console.error("❌ fetch-videos-diff2 error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
