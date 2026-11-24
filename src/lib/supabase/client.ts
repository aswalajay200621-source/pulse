import { createBrowserClient } from "@supabase/ssr";
import { getCleanSupabaseUrl } from "./config";

export function createClient() {
  const supabaseUrl = getCleanSupabaseUrl();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
