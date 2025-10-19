// src/lib/logQuota.ts
import { createClient } from "@supabase/supabase-js";

/**
 * SupabaseにAPIクォータ使用量を記録する共通関数
 * @param endpoint API識別名（例: "fetch-videos-diff"）
 * @param usage 使用量（unit換算）
 */
export async function logQuota(endpoint: string, usage: number) {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { error } = await supabase.from("quota_logs").insert({
      endpoint,
      usage,
    });

    if (error) {
      console.error(`❌ quota log insert failed (${endpoint}):`, error.message);
    } else {
      console.log(`📊 quota logged: ${endpoint} +${usage} units`);
    }
  } catch (err) {
    console.error("⚠️ quota logging exception:", err);
  }
}
