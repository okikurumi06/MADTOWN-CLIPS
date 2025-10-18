// src/app/api/update-stats/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  console.log("📊 update-stats: 再生数・高評価数の更新開始");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const yt = google.youtube({
    version: "v3",
    auth: process.env.YT_API_KEY || process.env.YT_API_KEY_BACKUP,
  });

  // ⏰ 直近6時間以内に更新された動画はスキップ
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();

  // 🎥 対象動画を取得
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, view_count, like_count, updated_at")
    .lt("updated_at", sixHoursAgo)
    .limit(300); // 1回あたり最大300件まで（API効率バランス）

  if (error) throw error;
  if (!videos?.length) {
    console.log("✅ 更新対象なし");
    return NextResponse.json({ ok: true, updated: 0 });
  }

  console.log(`🎬 更新対象: ${videos.length} 件`);

  const chunkSize = 50;
  let updatedCount = 0;

  for (let i = 0; i < videos.length; i += chunkSize) {
    const chunk = videos.slice(i, i + chunkSize);
    const ids = chunk.map((v) => v.id);

    try {
      const res = (await yt.videos.list({
        part: ["statistics"],
        id: ids,
      })) as unknown as { data: youtube_v3.Schema$VideoListResponse };

      const updates =
        res.data.items?.map((v) => ({
          id: v.id!,
          view_count: parseInt(v.statistics?.viewCount || "0"),
          like_count: parseInt(v.statistics?.likeCount || "0"),
          updated_at: new Date().toISOString(),
        })) || [];

      if (updates.length > 0) {
        const { error: upErr } = await supabase.from("videos").upsert(updates);
        if (upErr) throw upErr;
        updatedCount += updates.length;
        console.log(`✅ ${updates.length} 件更新 (${updatedCount} 件累計)`);
      }
    } catch (err) {
      console.warn(`⚠️ APIエラー: ${err}`);
    }
  }

  console.log(`🎉 update-stats 完了: ${updatedCount} 件`);
  return NextResponse.json({ ok: true, updated: updatedCount });
}
