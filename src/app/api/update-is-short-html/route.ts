// src/app/api/update-is-short-html/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { logQuota } from "@/src/lib/logQuota";

export const runtime = "nodejs";

export async function GET() {
  console.log("🔍 Shorts判定更新開始（未判定のみ・5分超はfalse扱い）");

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // ✅ is_short_final が null（未判定）のみ取得
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, title, duration, is_short_final")
    .is("is_short_final", null);

  if (error) throw error;
  if (!videos?.length)
    return NextResponse.json({
      ok: true,
      updated: 0,
      msg: "No unverified videos (すべて判定済み)",
    });

  // ⏱ ISO8601 → 秒変換
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
  const chunkSize = 5;

  for (let i = 0; i < videos.length; i += chunkSize) {
    const chunk = videos.slice(i, i + chunkSize);

    await Promise.all(
      chunk.map(async (v) => {
        try {
          const durationSec = parseDuration(v.duration);

          // 🚫 5分以上の動画はスキップではなく false に設定
          if (durationSec > 300) {
            console.log(`⏩ ${v.id} は ${Math.floor(durationSec / 60)}分 → 通常動画として false`);
            updates.push({ id: v.id, is_short_final: false });
            return;
          }

          let score = 0;
          const reason: string[] = [];
          const title = (v.title || "").toLowerCase();

          // 🎬 HTML解析
          const htmlRes = await fetch(`https://www.youtube.com/watch?v=${v.id}`, {
            headers: { "User-Agent": "Mozilla/5.0" },
          });

          if (htmlRes.ok) {
            const html = await htmlRes.text();

            // canonicalタグ
            const canonical =
              html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] || "";
            if (canonical.includes("/shorts/")) {
              score += 2;
              reason.push("canonical:/shorts/");
            }

            // keywordsタグ
            const keywords = html.match(/"keywords":\s*(\[[^\]]+\])/);
            if (keywords) {
              try {
                const tags = JSON.parse(keywords[1]);
                if (tags.some((t: string) => t.toLowerCase().includes("short"))) {
                  score += 2;
                  reason.push("keywords:short");
                }
              } catch {}
            }

            // アスペクト比（縦長）
            const width = html.match(/og:video:width" content="(\d+)"/)?.[1];
            const height = html.match(/og:video:height" content="(\d+)"/)?.[1];
            if (width && height && parseInt(height) > parseInt(width)) {
              score++;
              reason.push("縦長");
            }
          }

          // 🎯 Shorts URL存在チェック
          const shortsRes = await fetch(`https://www.youtube.com/shorts/${v.id}`, {
            method: "HEAD",
            redirect: "manual",
          });
          if ([200, 301, 302].includes(shortsRes.status)) {
            score += 2;
            reason.push("shortsURL存在");
          }

          // 🎯 タイトル・時間も加味
          if (title.includes("short") || title.includes("ショート")) {
            score++;
            reason.push("title:short");
          }
          if (durationSec <= 65) {
            score++;
            reason.push("短時間");
          }

          // ✅ 判定結果
          const isShort = score >= 2;
          updates.push({ id: v.id, is_short_final: isShort });
          console.log(
            `${isShort ? "✅" : "🧱"} ${v.id} → ${isShort ? "Shorts" : "通常"} (${score}点) [${reason.join(", ")}]`
          );
        } catch (err) {
          console.warn(`⚠️ ${v.id} 判定失敗:`, err);
          // 判定失敗時も null のまま放置せず false にする
          updates.push({ id: v.id, is_short_final: false });
        }
      })
    );
  }

  // 🔄 DB更新
  let updatedCount = 0;
  for (const u of updates) {
    const { error: updateErr } = await supabase
      .from("videos")
      .update({ is_short_final: u.is_short_final })
      .eq("id", u.id);

    if (updateErr) {
      console.warn(`⚠️ ${u.id} 更新失敗:`, updateErr.message);
    } else {
      updatedCount++;
    }
  }

  // 📊 クォータ記録
  await logQuota("update-is-short-html", 20);

  console.log(`✅ 更新完了: ${updatedCount} 件`);
  return NextResponse.json({ ok: true, updated: updatedCount });
}
