// src/app/api/search/route.ts
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
    const query = searchParams.get("q")?.trim() || "";
    const type = searchParams.get("type") || "all"; // "all" | "short" | "normal"
    const order = searchParams.get("order") || "view_count"; // ← new!
    const limit = parseInt(searchParams.get("limit") || "50");

    // 🧱 ベースクエリ
    let builder = supabase
      .from("videos")
      .select(
        "id, title, channel_name, view_count, like_count, thumbnail_url, published_at, is_short_final"
      )
      .order(order, { ascending: false })
      .limit(limit);

    // 🔍 タイトル・チャンネル名検索
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

    const { data, error } = await builder;
    if (error) throw error;

    return NextResponse.json({
      ok: true,
      type,
      order,
      count: data?.length || 0,
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
