// src/app/api/fetch-videos-recover/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
const MAX_RESULTS = 25;

export async function GET() {
  try {
    const yt = google.youtube({
      version: "v3",
      auth: process.env.YT_API_KEY || process.env.YT_API_KEY_BACKUP,
    });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🔍 Supabaseから最近30日以内の動画のみを対象に再取得
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    console.log(`♻️ 再取得対象: ${since} 以降`);

    const { data: channels, error: chError } = await supabase
      .from("madtown_channels")
      .select("id, name")
      .eq("active", true);

    if (chError) throw chError;
    if (!channels?.length) throw new Error("有効なチャンネルが登録されていません。");

    let totalRecovered = 0;
    const now = new Date().toISOString();

    for (const ch of channels) {
      console.log(`📡 再取得チャンネル: ${ch.name} (${ch.id})`);
      let nextPageToken: string | undefined = undefined;
      const collectedIds = new Set<string>();

      do {
        const searchRes = (await yt.search.list({
          part: ["id"],
          channelId: ch.id!,
          type: ["video"],
          order: "date",
          maxResults: MAX_RESULTS,
          publishedAfter: since,
          pageToken: nextPageToken,
        })) as unknown as { data: youtube_v3.Schema$SearchListResponse };

        const ids =
          searchRes.data.items
            ?.map((v) => v.id?.videoId)
            .filter(Boolean) as string[];

        ids.forEach((id) => collectedIds.add(id!)); // 重複防止

        // 🩹 nullをundefinedに変換して型安全に代入
        nextPageToken = searchRes.data.nextPageToken ?? undefined;
      } while (nextPageToken);

      const idArray = Array.from(collectedIds);
      if (!idArray.length) continue;

      const statsRes = (await yt.videos.list({
        part: ["snippet", "statistics", "contentDetails"],
        id: idArray,
      })) as unknown as { data: youtube_v3.Schema$VideoListResponse };

      const videos =
        statsRes.data.items?.map((v) => ({
          id: v.id!,
          title: v.snippet?.title || "",
          channel_name: v.snippet?.channelTitle || "",
          view_count: parseInt(v.statistics?.viewCount || "0"),
          like_count: parseInt(v.statistics?.likeCount || "0"),
          published_at: v.snippet?.publishedAt,
          thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
          duration: v.contentDetails?.duration || "",
          is_short_final: false,
          season: "2025-10",
          updated_at: now,
        })) || [];

      if (videos.length > 0) {
        const { error } = await supabase.from("videos").upsert(videos);
        if (error) throw error;
        totalRecovered += videos.length;
        console.log(`✅ ${ch.name}: ${videos.length} 件回復 (${totalRecovered} 件累計)`);
      }
    }

    console.log(`🎉 再取得完了: ${totalRecovered} 件`);
    return NextResponse.json({ ok: true, recovered: totalRecovered });
  } catch (error: any) {
    console.error("❌ fetch-videos-recover error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
