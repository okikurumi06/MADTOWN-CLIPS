// src/app/api/cleanup-deleted-videos/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { google } from "googleapis";

export const runtime = "nodejs";

export async function GET() {
  console.log("🧹 YouTube削除動画クリーンアップ開始");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const yt = google.youtube({
    version: "v3",
    auth: process.env.YT_API_KEY || process.env.YT_API_KEY_BACKUP,
  });

  // 🎥 DBから全IDを取得（または最近1ヶ月以内のみに制限してもOK）
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, title")
    .limit(500);

  if (error) throw error;
  if (!videos?.length)
    return NextResponse.json({ ok: true, deleted: 0, msg: "No videos found" });

  const deletedIds: string[] = [];
  const chunkSize = 25; // API制限対策

  // 🔁 25件ずつチェック
  for (let i = 0; i < videos.length; i += chunkSize) {
    const chunk = videos.slice(i, i + chunkSize);
    const ids = chunk.map((v) => v.id);

    try {
      const res = await yt.videos.list({
        part: ["id"],
        id: ids.join(","),
      });

      // APIに存在しないIDを特定
      const existingIds = new Set(res.data.items?.map((v) => v.id) || []);
      const missing = ids.filter((id) => !existingIds.has(id));

      if (missing.length > 0) {
        console.log(`🗑️ 削除対象: ${missing.join(", ")}`);
        deletedIds.push(...missing);
      }
    } catch (err) {
      console.warn("⚠️ API呼び出し失敗:", err);
    }
  }

  // 🧾 Supabaseから削除
  let deletedCount = 0;
  for (const id of deletedIds) {
    const { error: delErr } = await supabase.from("videos").delete().eq("id", id);
    if (!delErr) deletedCount++;
  }

  console.log(`✅ 削除完了: ${deletedCount} 件`);
  return NextResponse.json({ ok: true, deleted: deletedCount });
}
