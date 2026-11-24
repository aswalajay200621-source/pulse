"use client";

import * as React from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { AlertTriangle, Key } from "lucide-react";

export function SupabaseNotice() {
  const [configured, setConfigured] = React.useState(true);

  React.useEffect(() => {
    setConfigured(isSupabaseConfigured());
  }, []);

  if (configured) return null;

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3.5 text-xs text-amber-700 dark:text-amber-300">
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-amber-800 dark:text-amber-200">
            Supabase Credentials Required
          </p>
          <p className="text-[11px] leading-relaxed text-muted-foreground dark:text-amber-300/80">
            Real Supabase authentication is active. To enable live sign-in and registration, configure your actual credentials in <code className="rounded bg-amber-500/20 px-1 py-0.5 font-mono text-amber-900 dark:text-amber-100">.env.local</code>:
          </p>
          <div className="font-mono text-[10px] text-amber-900/90 dark:text-amber-200/90 bg-amber-500/20 p-2 rounded">
            NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co<br />
            NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
          </div>
        </div>
      </div>
    </div>
  );
}
