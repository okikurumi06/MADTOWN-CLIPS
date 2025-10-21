import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { logQuota } from "@/src/lib/logQuota";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoUrl = url.searchParams.get("url");

  if (!videoUrl) {
    return NextResponse.json({ ok: false, error: "動画URLが指定されていません" }, { status: 400 });
  }

  // ✅ URLからvideoIdを抽出（短縮URL対応）
  const match = videoUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) || videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const videoId = match ? match[1] : null;

  if (!videoId) {
    return NextResponse.json({ ok: false, error: "動画IDを抽出できませんでした" }, { status: 400 });
  }

  console.log(`🎯 動画登録開始: ${videoId}`);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 🔑 APIキーのフェイルオーバー
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

  try {
    // 🎥 動画詳細取得
    const res = await trySearch(() =>
      yt.videos.list({
        part: ["snippet", "statistics", "contentDetails"],
        id: [videoId],
      })
    );

    const v = res.data.items?.[0];
    if (!v) throw new Error("動画が見つかりませんでした");

    const now = new Date().toISOString();

    // ⏱️ 長さを秒に変換
    const parseDuration = (iso: string): number => {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    };
    const durationSec = parseDuration(v.contentDetails?.duration || "");

    // 🎯 登録データ作成
    const data = {
      id: videoId,
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
    };

    // 📦 Supabaseへ登録（重複は上書き）
    const { error } = await supabase.from("videos").upsert(data);
    if (error) throw error;

    // 🧩 チャンネル登録（存在しなければ追加）
    const { data: exists } = await supabase
      .from("madtown_channels")
      .select("id")
      .eq("id", data.channel_id)
      .maybeSingle();

    if (!exists && data.channel_id) {
      await supabase.from("madtown_channels").insert({
        id: data.channel_id,
        name: data.channel_name,
        active: true,
        created_at: now,
      });
      console.log(`🆕 新チャンネル登録: ${data.channel_name}`);
    }

    await logQuota("register-video-by-url", 10);

    return NextResponse.json({
      ok: true,
      video: {
        id: videoId,
        title: data.title,
        channel: data.channel_name,
        durationSec,
      },
    });
  } catch (error: any) {
    console.error("❌ register-video-by-url error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
