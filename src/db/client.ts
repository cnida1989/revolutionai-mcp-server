/**
 * Supabase client factory for the MCP server.
 * Mirrors revolutionai/lib/supabase/server.ts:33-46
 */

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

export function createAdminClient() {
  if (!supabaseUrl) {
    throw new Error(
      "SUPABASE_URL is required. Set it in your environment or .env file.",
    );
  }
  if (!supabaseSecretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is required for database operations. " +
        "Create one at Supabase Dashboard > Project Settings > API Keys",
    );
  }
  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
