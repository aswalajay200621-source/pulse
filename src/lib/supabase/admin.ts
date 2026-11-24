import { createClient } from "@supabase/supabase-js";
import { getCleanSupabaseUrl } from "./config";

/**
 * Creates a Supabase Admin client using the Service Role Key.
 * Used exclusively by server-side background workers (e.g., scheduled monitoring)
 * where no user session cookie is present.
 */
export function createAdminClient() {
  const supabaseUrl = getCleanSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not configured. Background monitoring requires the service role key."
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
