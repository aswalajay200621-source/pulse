import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AccountHeader } from "./account-header";

export async function ServerAccountHeader() {
  if (!isSupabaseConfigured()) {
    return <AccountHeader user={null} />;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return <AccountHeader user={null} />;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name, full_name, roles")
      .eq("id", user.id)
      .maybeSingle();

    const displayName =
      profile?.display_name ||
      profile?.full_name ||
      user.email?.split("@")[0] ||
      "User";

    const rawRoles = Array.isArray(profile?.roles) ? profile.roles : ["developer"];
    const roles = rawRoles.filter(
      (r): r is "developer" | "tester" => r === "developer" || r === "tester"
    );

    return (
      <AccountHeader
        user={{
          displayName: displayName.slice(0, 60),
          roles: roles.length > 0 ? roles : ["developer"],
        }}
      />
    );
  } catch {
    return <AccountHeader user={null} />;
  }
}
