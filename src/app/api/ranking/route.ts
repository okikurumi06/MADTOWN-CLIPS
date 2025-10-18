// src/app/api/ranking/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { searchParams } = new URL(request.url);

    // 📊 パラメータ取得
    const period = searchParams.get("period") || "week"; // "day" | "week" | "all"
    const type = searchParams.get("type") || "all"; // "all" | "short" | "normal"
    const order = searchParams.get("order") || "view_count"; // "view_count" | "published_at"

    // 📅 期間指定（"all" の場合は期間制限なし）
    const now = new Date();
    let from: Date | null = null;
    if (period === "day") {
      from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === "week") {
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 🧱 ベースクエリ
    let builder = supabase
      .from("videos")
      .select(
        "id, title, channel_name, view_count, like_count, thumbnail_url, published_at, is_short_final"
      )
      .order(order, { ascending: false })
      .limit(50);

    // 🕒 期間フィルタ（全体はスキップ）
    if (from) {
      builder = builder.gte("published_at", from.toISOString());
    }

    // 🎞️ 動画タイプフィルタ
    if (type === "short") {
      builder = builder.eq("is_short_final", true);
    } else if (type === "normal") {
      builder = builder.eq("is_short_final", false);
    }

    const { data, error } = await builder;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      period,
      type,
      order,
      count: data?.length || 0,
      results: data,
    });
  } catch (error: any) {
    console.error("❌ ranking error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
