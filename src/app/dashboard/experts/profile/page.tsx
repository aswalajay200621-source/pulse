"use client";

import * as React from "react";
import Link from "next/link";
import { getTesterProfile, upsertTesterProfile } from "@/app/actions/experts";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

export default function TesterProfilePage() {
  const [displayName, setDisplayName] = React.useState("");
  const [skillLevel, setSkillLevel] = React.useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [focusAreas, setFocusAreas] = React.useState("");
  const [proofUrl, setProofUrl] = React.useState("");
  const [status, setStatus] = React.useState<string | null>(null);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    getTesterProfile().then((res) => {
      if (res.profile) {
        setDisplayName(res.profile.display_name || "");
        setSkillLevel(res.profile.skill_level || "beginner");
        setFocusAreas((res.profile.focus_areas || []).join(", "));
        setProofUrl(res.profile.proof_url || "");
        setStatus(res.profile.status);
      }
    });
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    const res = await upsertTesterProfile({
      display_name: displayName,
      skill_level: skillLevel,
      focus_areas: focusAreas.split(",").map((s) => s.trim()).filter(Boolean),
      proof_url: proofUrl,
    });
    if (res.error) setError(res.error);
    else {
      setMessage("Tester profile saved.");
      if (!status) setStatus("pending");
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Link href="/dashboard/experts" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Experts
      </Link>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Tester Profile</CardTitle>
          <CardDescription className="text-xs">
            Status:{" "}
            <span className="font-mono uppercase font-semibold text-foreground">
              {status || "Not registered"}
            </span>{" "}
            (Approved by Pulse admins)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && <div className="mb-3 text-xs text-red-500">{error}</div>}
          {message && <div className="mb-3 text-xs text-emerald-500">{message}</div>}
          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div>
              <label className="block font-medium mb-1">Display Name *</label>
              <Input required value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </div>
            <div>
              <label className="block font-medium mb-1">Skill Level</label>
              <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value as "beginner" | "intermediate" | "advanced")} className="w-full h-9 rounded-md border border-border bg-background px-3">
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div>
              <label className="block font-medium mb-1">Focus Areas (comma-separated)</label>
              <Input value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} placeholder="auth, payments, API" />
            </div>
            <div>
              <label className="block font-medium mb-1">Portfolio / Proof URL</label>
              <Input value={proofUrl} onChange={(e) => setProofUrl(e.target.value)} placeholder="https://github.com/..." />
            </div>
            <Button type="submit" size="sm">Save Profile</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
