// src/app/api/recalculate-shorts/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  console.log("🔁 Shorts再計算開始");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const yt = google.youtube({
    version: "v3",
    auth: process.env.YT_API_KEY || process.env.YT_API_KEY_BACKUP,
  });

  // 🎥 全動画を取得（必要に応じて条件変更）
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, duration, title, is_short_final");

  if (error) throw error;
  if (!videos?.length)
    return NextResponse.json({ ok: true, updated: 0, msg: "No videos found" });

  const parseDuration = (iso: string | null): number => {
    if (!iso) return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || "0");
    const min = parseInt(m[2] || "0");
    const s = parseInt(m[3] || "0");
    return h * 3600 + min * 60 + s;
  };

  const updates: { id: string; is_short_final: boolean }[] = [];

  // 🔁 10件ずつ処理
  const chunkSize = 10;
  const chunks = Array.from({ length: Math.ceil(videos.length / chunkSize) }, (_, i) =>
    videos.slice(i * chunkSize, i * chunkSize + chunkSize)
  );

  for (const chunk of chunks) {
    const ids = chunk.map((v) => v.id);

    // ✅ 型修正: id は string[]
    const res = await yt.videos.list({
      part: ["contentDetails", "snippet"],
      id: ids,
    });

    const items = res.data.items || [];

    for (const item of items) {
      const duration = item.contentDetails?.duration || "";
      const durationSec = parseDuration(duration);
      const title = item.snippet?.title?.toLowerCase() || "";

      const isShort =
        durationSec > 0 &&
        durationSec <= 65 &&
        (title.includes("short") || title.includes("ショート"));

      if (isShort) {
        updates.push({ id: item.id!, is_short_final: true });
        console.log(`🎯 ${item.id} → Shorts (${durationSec}s)`);
      }
    }
  }

  // 🔄 Supabase更新
  let updatedCount = 0;
  for (const u of updates) {
    const { error: updateErr } = await supabase
      .from("videos")
      .update({ is_short_final: u.is_short_final })
      .eq("id", u.id);

    if (!updateErr) updatedCount++;
  }

  console.log(`✅ 更新完了: ${updatedCount} 件`);
  return NextResponse.json({ ok: true, updated: updatedCount });
}
