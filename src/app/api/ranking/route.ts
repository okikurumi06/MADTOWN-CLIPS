// src/app/api/ranking/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "48", 10);
    const offset = (page - 1) * limit;

    const period = searchParams.get("period") || "week";
    const type = searchParams.get("type") || "all";
    const order = searchParams.get("order") || "view_count";

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // 🗓️ 期間フィルタ（日間・週間・全体）
    const now = new Date();
    let since: Date | null = null;
    if (period === "day") {
      since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    } else if (period === "week") {
      since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // 🔍 ベースクエリ
    let query = supabase
      .from("videos")
      .select("*", { count: "exact" })
      .order(order as "view_count" | "published_at", { ascending: false });

    if (since) {
      query = query.gte("published_at", since.toISOString());
    }

    // 🎞️ 通常／ショート絞り込み
    if (type === "short") {
      query = query.eq("is_short_final", true);
    } else if (type === "normal") {
      query = query.eq("is_short_final", false);
    }

    // 📄 ページ指定（rangeは0始まり）
    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error("❌ ranking API error:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      data,
      page,
      total: count,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error: any) {
    console.error("❌ ranking route error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}