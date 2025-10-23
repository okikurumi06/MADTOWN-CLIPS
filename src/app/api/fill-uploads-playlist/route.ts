// src/app/api/fill-uploads-playlist/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

// ✅ サーバーサイドで実行（Next.js App Router用設定）
export const runtime = "nodejs";

export async function GET() {
  // 🔗 Supabaseクライアント初期化（Service Roleキーで認証）
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 🔑 YouTube Data API v3 初期化（YT_API_KEY4 を使用）
  const yt = google.youtube({
    version: "v3",
    auth: process.env.YT_API_KEY4, // この環境変数がVercelに登録されていることを確認！
  });

  // 🧩 uploads_playlist_id が NULL のチャンネルのみ取得
  const { data: channels, error: fetchError } = await supabase
    .from("madtown_channels")
    .select("id, name")
    .is("uploads_playlist_id", null);

  if (fetchError) {
    console.error("❌ Supabaseからチャンネル取得エラー:", fetchError.message);
    return NextResponse.json(
      { ok: false, error: fetchError.message },
      { status: 500 }
    );
  }

  if (!channels?.length) {
    console.log("✅ すべてのチャンネルに uploads_playlist_id が登録済みです。");
    return NextResponse.json({ ok: true, message: "No pending channels" });
  }

  console.log(`📡 更新対象チャンネル数: ${channels.length}`);

  let successCount = 0;
  let failCount = 0;

  // 🧱 各チャンネルについて YouTube API から uploads_playlist_id を取得
  for (const ch of channels) {
    try {
      // 📺 チャンネル詳細を取得
      const res = await yt.channels.list({
        part: ["contentDetails"],
        id: ch.id,
      });

      // 🎯 アップロード動画プレイリストIDを抽出
      const uploads =
        res.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

      if (uploads) {
        // ✅ Supabaseに保存
        const { error: updateError } = await supabase
          .from("madtown_channels")
          .update({ uploads_playlist_id: uploads })
          .eq("id", ch.id);

        if (updateError) throw updateError;

        console.log(`✅ ${ch.name}: 登録成功 → ${uploads}`);
        successCount++;
      } else {
        console.warn(`⚠️ ${ch.name}: uploads_playlist_id が取得できませんでした`);
        failCount++;
      }
    } catch (e: any) {
      console.error(`❌ ${ch.name} 取得エラー:`, e.message || e);
      failCount++;
    }
  }

  console.log(
    `🎉 バックフィル完了: 成功 ${successCount} 件 / 失敗 ${failCount} 件`
  );

  return NextResponse.json({
    ok: true,
    successCount,
    failCount,
    total: channels.length,
  });
}
