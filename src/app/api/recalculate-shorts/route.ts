// src/app/api/recalculate-shorts/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  try {
    const yt = google.youtube({
      version: "v3",
      auth: process.env.YT_API_KEY,
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🧭 Supabaseから全動画IDを取得
    const { data: allVideos, error: fetchErr } = await supabase
      .from("videos")
      .select("id, title");
    if (fetchErr) throw fetchErr;
    if (!allVideos?.length)
      return NextResponse.json({ ok: false, message: "no videos" });

    const chunks = [];
    for (let i = 0; i < allVideos.length; i += 50) {
      chunks.push(allVideos.slice(i, i + 50));
    }

    let updatedCount = 0;

    for (const chunk of chunks) {
      const ids = chunk.map((v) => v.id);
      const res = await yt.videos.list({
        part: ["contentDetails", "snippet"],
        id: ids.join(","),
      });

      const items = res.data.items || [];

      for (const v of items) {
        const title = v.snippet?.title || "";
        const duration = v.contentDetails?.duration || "";

        // ⏱ duration → 秒数に変換
        const match = duration.match(/PT(?:(\d+)M)?(?:(\d+)S)?/);
        const minutes = match?.[1] ? parseInt(match[1]) : 0;
        const seconds = match?.[2] ? parseInt(match[2]) : 0;
        const totalSeconds = minutes * 60 + seconds;

        // 🎯 改良版ロジック（時間のみで判定）
        const is_short =
          title.toLowerCase().includes("#shorts") ||
          totalSeconds === 0 ||
          totalSeconds < 61;

        // 💾 部分更新
        const { error: updateErr } = await supabase
          .from("videos")
          .update({ is_short })
          .eq("id", v.id!);

        if (updateErr)
          console.warn("⚠️ update skipped:", v.id, updateErr.message);
        else updatedCount++;
      }

      // API制限対策
      await new Promise((r) => setTimeout(r, 500));
    }

    return NextResponse.json({
      ok: true,
      updated: updatedCount,
    });
  } catch (err: any) {
    console.error("❌ recalc error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
