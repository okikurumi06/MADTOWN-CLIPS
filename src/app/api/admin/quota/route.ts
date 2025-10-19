//src/app/api/admin/quota/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 🔢 過去7日分を集計
  const { data, error } = await supabase
    .from("quota_logs")
    .select("usage, created_at")
    .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  if (error) {
    console.error("❌ quota fetch error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  // 日ごとに集計
  const grouped: Record<string, number> = {};
  for (const log of data || []) {
    const date = new Date(log.created_at).toLocaleDateString("ja-JP");
    grouped[date] = (grouped[date] || 0) + log.usage;
  }

  const result = Object.entries(grouped).map(([date, usage]) => ({ date, usage }));
  return NextResponse.json({ ok: true, data: result });
}
