// src/app/api/fetch-videos-diff/route.ts
import { NextResponse } from "next/server";
import { google, youtube_v3 } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { logQuota } from "@/src/lib/logQuota";

// Node.js ランタイムを明示（Edgeではgoogleapisが動作しない）
export const runtime = "nodejs";

// チューニング用パラメータ
const MAX_RESULTS = 5;         // 1チャンネルあたり取得最大件数
const ACTIVE_WITHIN_DAYS = 5;  // 直近チェック日から何日以内を対象にする


export async function GET() {
  try {
    /** ===============================
     * 🏗️ Supabase初期化
     * =============================== */
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    /** ===============================
     * 🕒 最新の動画投稿日を取得
     * =============================== */
    const { data: latest, error: latestError } = await supabase
      .from("videos")
      .select("published_at")
      .order("published_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestError) throw latestError;
    const publishedAfter = latest?.published_at || "2025-10-01T00:00:00Z";
    const now = new Date().toISOString();
    console.log(`📺 差分取得開始: ${publishedAfter} 以降`);

    /** ===============================
     * 🧭 対象チャンネルを抽出
     * =============================== */
    const since = new Date();
    since.setDate(since.getDate() - ACTIVE_WITHIN_DAYS);

    const { data: channels, error: chError } = await supabase
      .from("madtown_channels")
      .select("id, name, last_checked")
      .eq("active", true)
      .or(`last_checked.is.null,last_checked.gt.${since.toISOString()}`);

    if (chError) throw chError;
    if (!channels?.length) throw new Error("最近アクティブなチャンネルがありません。");
    const limitedChannels = channels.slice(0, 30);

    console.log(`📡 対象チャンネル: ${channels.length} 件`);

    /** ===============================
     * 🔑 YouTube APIセットアップ
     * =============================== */
    const keys = [
      process.env.YT_API_KEY,
      process.env.YT_API_KEY_BACKUP,
      process.env.YT_API_KEY_BACKUP_2,
    ].filter(Boolean) as string[];

    let yt = google.youtube({ version: "v3", auth: keys[0] });

    // クォータ制限が出たら自動的に次のAPIキーへ切替
    const trySearch = async (fn: () => Promise<any>) => {
      for (let i = 0; i < keys.length; i++) {
        try {
          yt = google.youtube({ version: "v3", auth: keys[i] });
          return await fn();
        } catch (e: any) {
          if (e.code === 403 && e.message?.includes("quota")) {
            console.warn(`⚠️ APIキー${i + 1}でquota超過、次キーに切替`);
            continue;
          }
          throw e;
        }
      }
      throw new Error("すべてのAPIキーでquota制限に達しました。");
    };

    /** ===============================
     * ⏱️ ISO8601 → 秒 変換関数
     * =============================== */
    const parseDuration = (iso: string): number => {
      const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!m) return 0;
      const h = parseInt(m[1] || "0");
      const min = parseInt(m[2] || "0");
      const s = parseInt(m[3] || "0");
      return h * 3600 + min * 60 + s;
    };

    let totalInserted = 0;
    let idFixedCount = 0;

    /** ===============================
     * 🧩 各チャンネルごとの動画取得ループ
     * =============================== */
    for (const ch of channels) {
      console.log(`\n📡 チャンネル処理中: ${ch.name} (${ch.id})`);

      /** 🧠 1️⃣ チャンネルIDがUUID（UCで始まらない）場合は補正する */
      let channelId = ch.id;
      if (!channelId.startsWith("UC")) {
        console.log(`⚙️ UUID検出 → 正式チャンネルID検索開始 (${ch.name})`);

        const chSearch = await trySearch(() =>
          yt.search.list({
            part: ["snippet"],
            q: ch.name,
            type: ["channel"],
            maxResults: 1,
          })
        );

        const realId = chSearch.data.items?.[0]?.snippet?.channelId;
        if (realId) {
          channelId = realId;
          idFixedCount++;

          // ✅ Supabase側のIDを正式IDで更新
          await supabase
            .from("madtown_channels")
            .update({ id: realId })
            .eq("name", ch.name);

          console.log(`✅ ${ch.name}: IDを正式化 → ${realId}`);
        } else {
          console.warn(`⚠️ ${ch.name}: チャンネルID検索失敗 → スキップ`);
          continue;
        }
      }

      /** 🧠 2️⃣ 新着動画の検索 */
      const searchRes = await trySearch(() =>
        yt.search.list({
          part: ["id"],
          channelId,
          type: ["video"],
          maxResults: MAX_RESULTS,
          order: "date",
          publishedAfter,
        })
      );

      const ids = searchRes.data.items
        ?.map((v: any) => v.id?.videoId)
        .filter(Boolean) as string[];

      if (!ids?.length) continue;

      /** 🧠 3️⃣ 動画詳細データを取得 */
      const statsRes = await trySearch(() =>
        yt.videos.list({
          part: ["snippet", "statistics", "contentDetails"],
          id: ids,
        })
      );

      /** 🧠 4️⃣ MADTOWN関連タイトルだけを抽出 */
      const videos =
        statsRes.data.items
          ?.filter((v: any) => {
            const title = v.snippet?.title?.toLowerCase() || "";
            const dur = parseDuration(v.contentDetails?.duration || "");
            const live = v.snippet?.liveBroadcastContent;
            return title.includes("madtown") && dur > 0 && dur <= 3600 && live === "none";
          })
          .map((v: any) => ({
            id: v.id!,
            title: v.snippet?.title || "",
            channel_id: v.snippet?.channelId || channelId,
            channel_name: v.snippet?.channelTitle || ch.name,
            view_count: parseInt(v.statistics?.viewCount || "0"),
            like_count: parseInt(v.statistics?.likeCount || "0"),
            published_at: v.snippet?.publishedAt,
            thumbnail_url: v.snippet?.thumbnails?.medium?.url || "",
            duration: v.contentDetails?.duration || "",
            season: "2025-10",
            updated_at: now,
          })) || [];

      /** 🧠 5️⃣ DBへ upsert */
      if (videos.length > 0) {
        const { error } = await supabase.from("videos").upsert(videos);
        if (error) throw error;
        totalInserted += videos.length;
        console.log(`✅ ${ch.name}: ${videos.length} 件追加 (${totalInserted} 累計)`);

        // チェック日を更新
        await supabase
          .from("madtown_channels")
          .update({ last_checked: now })
          .eq("id", channelId);
      }
    }

    /** ===============================
     * ✅ 結果まとめ
     * =============================== */
    console.log(`\n🎉 差分取得完了: ${totalInserted} 件`);
    console.log(`🔧 ID自動補正: ${idFixedCount} 件`);

    await logQuota("fetch-videos-diff", 50);

    return NextResponse.json({
      ok: true,
      inserted: totalInserted,
      id_fixed: idFixedCount,
      since: publishedAfter,
      timestamp: now,
    });
  } catch (error: any) {
    console.error("❌ fetch-videos-diff error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}
