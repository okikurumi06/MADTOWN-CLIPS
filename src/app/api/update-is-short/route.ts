// src/app/api/update-is-short/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

export const runtime = "nodejs";

/** ISO8601 duration → 秒数変換 */
function parseDurationToSeconds(duration: string): number {
  const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const minutes = parseInt(match[1] || "0", 10);
  const seconds = parseInt(match[2] || "0", 10);
  return minutes * 60 + seconds;
}

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const yt = google.youtube({
      version: "v3",
      auth: process.env.YT_API_KEY,
    });

    console.log("🔄 正確なショート判定を実行中...");

    // 🎯 まず動画IDリストを取得
    const { data: videos, error } = await supabase
      .from("videos")
      .select("id, duration, is_shorts_playable, title");
    if (error) throw error;

    const updates: { id: string; is_short_final: boolean }[] = [];

    // 🔁 バッチ処理（50件ずつ YouTube API 呼び出し）
    for (let i = 0; i < videos.length; i += 50) {
      const batch = videos.slice(i, i + 50);
      const ids = batch.map((v) => v.id).join(",");

      const res = await yt.videos.list({
        part: ["contentDetails", "player", "snippet"],
        id: ids,
      });

      for (const item of res.data.items || []) {
        const seconds = parseDurationToSeconds(item.contentDetails?.duration || "");
        const isPlayable = batch.find((v) => v.id === item.id)?.is_shorts_playable === true;
        const title = batch.find((v) => v.id === item.id)?.title || "";

        // 🎯 判定ロジック
        const isShort =
          seconds <= 61 ||
          isPlayable ||
          title.toLowerCase().includes("#shorts") ||
          (item.player?.embedHtml?.includes("shorts-player") ?? false);

        updates.push({ id: item.id!, is_short_final: isShort });
      }
    }

    // 🧾 Supabaseを更新
    for (const u of updates) {
      const { error: updateErr } = await supabase
        .from("videos")
        .update({ is_short_final: u.is_short_final })
        .eq("id", u.id);
      if (updateErr) throw updateErr;
    }

    const shortCount = updates.filter((u) => u.is_short_final).length;
    const normalCount = updates.length - shortCount;

    console.log(`✅ is_short_final 更新完了: ${updates.length}件`);
    return NextResponse.json({
      ok: true,
      total: updates.length,
      short_videos: shortCount,
      normal_videos: normalCount,
    });
  } catch (error: any) {
    console.error("❌ update-is-short error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
