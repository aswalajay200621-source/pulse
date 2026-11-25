"use client";

import * as React from "react";
import Link from "next/link";
import {
  getMyProfile,
  updateProfile,
  type UserProfileData,
  type UserRole,
  type SkillLevel,
} from "@/app/actions/profile";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, AlertCircle, ShieldAlert, Settings } from "lucide-react";

const FOCUS_OPTIONS = [
  "Websites and web apps",
  "Mobile apps",
  "APIs",
  "Security and bug bounty",
  "Manual testing",
  "Automated testing",
];

const STATUS_INFO: Record<string, { label: string; desc: string; cls: string }> = {
  pending: {
    label: "Pending Review",
    desc: "Your tester application is waiting for an admin to review and approve it.",
    cls: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
  },
  approved: {
    label: "Approved",
    desc: "You are approved to accept invites and submit security/bug reports.",
    cls: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  },
  rejected: {
    label: "Not Approved",
    desc: "Your tester application was not approved. You can update your proof link and contact an admin.",
    cls: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  },
};

export default function ProfilePage() {
  const [profile, setProfile] = React.useState<UserProfileData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [displayName, setDisplayName] = React.useState("");
  const [roles, setRoles] = React.useState<UserRole[]>(["developer"]);
  const [skillLevel, setSkillLevel] = React.useState<SkillLevel>("intermediate");
  const [focusAreas, setFocusAreas] = React.useState<string[]>([]);
  const [proofUrl, setProofUrl] = React.useState("");
  const [contact, setContact] = React.useState("");

  React.useEffect(() => {
    getMyProfile().then((res) => {
      if (res.data) {
        setProfile(res.data);
        setDisplayName(res.data.display_name);
        setRoles(res.data.roles);
        if (res.data.tester_profile) {
          setSkillLevel(res.data.tester_profile.skill_level);
          setFocusAreas(res.data.tester_profile.focus_areas);
          setProofUrl(res.data.tester_profile.proof_url || "");
          setContact(res.data.tester_profile.contact || "");
        }
      }
      setLoading(false);
    });
  }, []);

  const toggleRole = (role: UserRole) => {
    const has = roles.includes(role);
    if (has && roles.length === 1) {
      setMessage({ type: "err", text: "At least one role must remain selected." });
      return;
    }
    if (has) {
      const msg =
        role === "tester"
          ? "Removing the Tester role will hide the Experts tester area and block new report submissions, though your past data is kept. Continue?"
          : "Removing the Developer role will hide creating new apps, though your existing apps and data are kept. Continue?";
      if (!confirm(msg)) return;
      setRoles(roles.filter((r) => r !== role));
    } else {
      setRoles([...roles, role]);
    }
  };

  const toggleFocus = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage(null);

    const res = await updateProfile({
      displayName,
      roles,
      skillLevel: roles.includes("tester") ? skillLevel : undefined,
      focusAreas: roles.includes("tester") ? focusAreas : undefined,
      proofUrl: roles.includes("tester") ? proofUrl : undefined,
      contact: roles.includes("tester") ? contact : undefined,
    });

    if (!res.success) {
      setMessage({ type: "err", text: res.error || "Failed to update profile." });
    } else {
      setMessage({
        type: "ok",
        text: res.needsReview
          ? "Profile saved. Because you changed your skill level or proof link, an admin may re-review your tester profile."
          : "Profile saved successfully.",
      });
      const refreshed = await getMyProfile();
      if (refreshed.data) setProfile(refreshed.data);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="p-6 text-xs text-muted-foreground">Loading profile...</div>;
  }

  const hasTester = roles.includes("tester");
  const statusInfo = profile?.tester_profile
    ? STATUS_INFO[profile.tester_profile.status]
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between border-b border-border/60 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Profile &amp; Roles</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your display name, active roles, and tester details.
          </p>
        </div>
        <Link href="/dashboard/settings">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs">
            <Settings className="h-3.5 w-3.5" /> Account Settings
          </Button>
        </Link>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Basic Info &amp; Roles</CardTitle>
            <CardDescription className="text-xs">
              Email and password changes are managed in Account Settings.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label htmlFor="profile-display-name" className="block text-xs font-medium mb-1.5">
                Display Name
              </label>
              <Input
                id="profile-display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={60}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5">Active Roles</label>
              <div className="flex flex-wrap gap-2">
                {(["developer", "tester"] as UserRole[]).map((r) => {
                  const active = roles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(r)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                        active
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {hasTester && (
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                Tester Profile
              </CardTitle>
              {statusInfo && (
                <div className={`mt-2 rounded-md border p-2.5 text-xs ${statusInfo.cls}`}>
                  <span className="font-semibold">{statusInfo.label}: </span>
                  {statusInfo.desc}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5">Skill Level</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["beginner", "intermediate", "advanced"] as SkillLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setSkillLevel(lvl)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${
                        skillLevel === lvl
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium mb-1.5">Focus Areas</label>
                <div className="flex flex-wrap gap-2">
                  {FOCUS_OPTIONS.map((area) => {
                    const active = focusAreas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        onClick={() => toggleFocus(area)}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          active
                            ? "border-primary bg-primary/10 text-primary font-medium"
                            : "border-border/60 text-muted-foreground"
                        }`}
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="profile-proof" className="block text-xs font-medium mb-1.5">
                    Proof of Work Link
                  </label>
                  <Input
                    id="profile-proof"
                    type="url"
                    value={proofUrl}
                    onChange={(e) => setProofUrl(e.target.value)}
                    maxLength={300}
                    placeholder="https://github.com/..."
                  />
                </div>
                <div>
                  <label htmlFor="profile-contact" className="block text-xs font-medium mb-1.5">
                    Private Contact (only you &amp; admins)
                  </label>
                  <Input
                    id="profile-contact"
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    maxLength={200}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {message && (
          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-xs ${
              message.type === "ok"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-red-500/30 bg-red-500/10 text-red-500"
            }`}
          >
            {message.type === "ok" ? (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0" />
            )}
            <span>{message.text}</span>
          </div>
        )}

        <Button type="submit" disabled={saving}>
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </div>
  );
}
