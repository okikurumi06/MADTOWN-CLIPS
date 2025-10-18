// src/app/api/check-shorts-url-sync/route.ts
import { NextResponse } from "next/server";
import fetch from "node-fetch";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🎯 Supabaseから全動画ID取得
    const { data: videos, error: fetchErr } = await supabase
      .from("videos")
      .select("id");
    if (fetchErr) throw fetchErr;
    if (!videos?.length)
      return NextResponse.json({ ok: false, message: "no videos" });

    let updatedCount = 0;

    for (const [i, v] of videos.entries()) {
      const url = `https://www.youtube.com/shorts/${v.id}`;
      try {
        const res = await fetch(url, { method: "HEAD", redirect: "manual" });
        const isPlayable = res.status === 200;

        const { error: updateErr } = await supabase
          .from("videos")
          .update({ is_shorts_playable: isPlayable })
          .eq("id", v.id);

        if (updateErr)
          console.warn("⚠️ update skipped:", v.id, updateErr.message);
        else updatedCount++;

        // 🔄 API制限対策（0.3秒間隔）
        await new Promise((r) => setTimeout(r, 300));
      } catch (err: any) {
        console.warn(`❌ HEAD失敗 ${v.id}:`, err.message);
      }

      if ((i + 1) % 50 === 0)
        console.log(`✅ ${i + 1} 件処理完了...`);
    }

    return NextResponse.json({ ok: true, updated: updatedCount });
  } catch (err: any) {
    console.error("❌ check-shorts-url-sync error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
