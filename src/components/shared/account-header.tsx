"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LayoutDashboard, User, ShieldAlert, Settings, LogOut } from "lucide-react";

export interface AccountHeaderProps {
  user: {
    displayName: string;
    roles: ("developer" | "tester")[];
  } | null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function AccountHeader({ user }: AccountHeaderProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  const handleSignOut = async () => {
    setOpen(false);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  if (!user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle />
        <Link href="/login">
          <Button variant="ghost" size="sm">
            Sign in
          </Button>
        </Link>
        <Link href="/register">
          <Button size="sm" className="hidden xs:inline-flex">
            Get started
          </Button>
        </Link>
      </div>
    );
  }

  const isTester = user.roles.includes("tester");

  return (
    <div className="flex items-center gap-2.5 sm:gap-3" ref={menuRef}>
      <ThemeToggle />
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="Account menu"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {getInitials(user.displayName)}
        </button>

        {open && (
          <div
            role="menu"
            className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg z-50"
          >
            <div className="px-2.5 py-2 border-b border-border/60 mb-1">
              <p className="text-xs font-semibold text-foreground truncate">{user.displayName}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {user.roles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground"
                  >
                    {r}
                  </span>
                ))}
              </div>
            </div>

            <Link
              href="/dashboard"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            >
              <LayoutDashboard className="h-3.5 w-3.5 text-muted-foreground" />
              Dashboard
            </Link>
            <Link
              href="/dashboard/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            >
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              Profile
            </Link>
            {isTester && (
              <Link
                href="/dashboard/experts"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
              >
                <ShieldAlert className="h-3.5 w-3.5 text-muted-foreground" />
                Experts
              </Link>
            )}
            <Link
              href="/dashboard/settings"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
            >
              <Settings className="h-3.5 w-3.5 text-muted-foreground" />
              Settings
            </Link>

            <div className="my-1 border-t border-border/60" />

            <button
              type="button"
              role="menuitem"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
