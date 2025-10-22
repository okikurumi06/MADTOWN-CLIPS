// src/app/api/register-video-by-url/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { logQuota } from "@/src/lib/logQuota";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const videoUrl = url.searchParams.get("url");

  if (!videoUrl) {
    return NextResponse.json(
      { ok: false, error: "動画URLが指定されていません" },
      { status: 400 }
    );
  }

  // ✅ URLからvideoIdを抽出（短縮URL対応）
  const match =
    videoUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
    videoUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  const videoId = match ? match[1] : null;

  if (!videoId) {
    return NextResponse.json(
      { ok: false, error: "動画IDを抽出できませんでした" },
      { status: 400 }
    );
  }

  console.log(`🎯 動画登録開始: ${videoId}`);

  // ✅ Supabaseクライアント作成
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ✅ YouTube Data API キー（YT_API_KEY4 のみ使用）
  const apiKey = process.env.YT_API_KEY4;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, error: "YT_API_KEY_4 が設定されていません" },
      { status: 500 }
    );
  }

  // 🎬 YouTube API クライアント
  const yt = google.youtube({ version: "v3", auth: apiKey });

  try {
    // 🎥 動画詳細取得
    const res = await yt.videos.list({
      part: ["snippet", "statistics", "contentDetails"],
      id: [videoId],
    });

    const v = res.data.items?.[0];
    if (!v) throw new Error("動画が見つかりませんでした");

    const now = new Date().toISOString();

    // ⏱️ ISO8601形式の動画長を秒数に変換
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
    const { error } = await supabase.from("videos").upsert(data, { onConflict: "id" });
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
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
