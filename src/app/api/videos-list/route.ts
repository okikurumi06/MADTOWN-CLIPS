//src/app/api/videos-list/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from("videos")
    .select("id, title, duration, is_short_final, published_at, thumbnail_url")
    .order("published_at", { ascending: false })
    .limit(1000);

  if (error) throw error;

  return NextResponse.json({ ok: true, videos: data });
}
