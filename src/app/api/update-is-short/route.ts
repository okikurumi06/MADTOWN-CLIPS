// src/app/api/update-is-short/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function GET() {
  console.log("🔁 Shorts判定再計算開始");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const yt = google.youtube({
    version: "v3",
    auth: process.env.YT_API_KEY || process.env.YT_API_KEY_BACKUP,
  });

  // 🎥 全動画取得（is_short_final = false のみ）
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, title, duration, is_short_final")
    .eq("is_short_final", false);

  if (error) throw error;
  if (!videos?.length)
    return NextResponse.json({ ok: true, updated: 0, msg: "No videos found" });

  console.log(`🎬 対象: ${videos.length} 件`);

  // ISO8601 → 秒変換
  function parseDuration(iso: string | null): number {
    if (!iso) return 0;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!m) return 0;
    const h = parseInt(m[1] || "0");
    const min = parseInt(m[2] || "0");
    const s = parseInt(m[3] || "0");
    return h * 3600 + min * 60 + s;
  }

  const updates: { id: string; is_short_final: boolean }[] = [];

  // 🔁 10件ずつ処理
  const chunkSize = 10;
  for (let i = 0; i < videos.length; i += chunkSize) {
    const batch = videos.slice(i, i + chunkSize);
    const ids = batch.map((v) => v.id); // ← joinしない。配列のまま渡す

    try {
      const res = await yt.videos.list({
        part: ["contentDetails", "player", "snippet"],
        id: ids, // ✅ string[] を渡すよう修正
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
    } catch (err) {
      console.warn("⚠️ API取得失敗:", err);
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
