/**
 * Checks whether valid Supabase environment variables are configured.
 */
export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return false;
  if (url.includes("your-project-ref") || url.includes("placeholder-project")) return false;
  if (key === "your-actual-anon-public-key" || key === "placeholder-anon-key") return false;

  return true;
}

/**
 * Returns the normalized Supabase URL stripped of any trailing slashes or /rest/v1 paths.
 */
export function getCleanSupabaseUrl(): string {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder-project.supabase.co";
  url = url.trim().replace(/\/rest\/v1\/?$/, "").replace(/\/+$/, "");
  return url;
}
