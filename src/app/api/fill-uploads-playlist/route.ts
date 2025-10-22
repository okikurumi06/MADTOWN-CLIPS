// src/app/api/fill-uploads-playlist/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const yt = google.youtube({ version: "v3", auth: process.env.YT_API_KEY });

  const { data: channels } = await supabase.from("madtown_channels").select("id, name").is("uploads_playlist_id", null);

  for (const ch of channels || []) {
    const res = await yt.channels.list({ part: ["contentDetails"], id: ch.id });
    const uploads = res.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (uploads) {
      await supabase.from("madtown_channels").update({ uploads_playlist_id: uploads }).eq("id", ch.id);
      console.log(`✅ ${ch.name}: ${uploads}`);
    }
  }

  return NextResponse.json({ ok: true });
}
