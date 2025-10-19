// src/app/api/search/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    // ✅ 公開キーで読み取り専用クライアント
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() || "";
    const type = searchParams.get("type") || "all"; // "all" | "short" | "normal"
    const order = searchParams.get("order") || "view_count"; // "view_count" | "published_at"
    const limit = parseInt(searchParams.get("limit") || "48", 10);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const offset = (page - 1) * limit;

    // 🧱 ベースクエリ
    let builder = supabase
      .from("videos")
      .select(
        "id, title, channel_name, view_count, like_count, thumbnail_url, published_at, is_short_final",
        { count: "exact" }
      )
      .order(order as "view_count" | "published_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // 🔍 検索条件（タイトル or チャンネル名）
    if (query) {
      builder = builder.or(
        `title.ilike.%${query}%,channel_name.ilike.%${query}%`
      );
    }

    // 🎞️ 動画タイプフィルタ
    if (type === "short") {
      builder = builder.eq("is_short_final", true);
    } else if (type === "normal") {
      builder = builder.eq("is_short_final", false);
    }

    // 📊 実行
    const { data, error, count } = await builder;

    if (error) throw error;

    const totalPages = Math.ceil((count || 0) / limit);

    return NextResponse.json({
      ok: true,
      query,
      type,
      order,
      page,
      total: count || 0,
      totalPages,
      results: data || [],
    });
  } catch (error: any) {
    console.error("❌ search error:", error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}
