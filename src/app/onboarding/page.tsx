"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoLink } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { completeOnboarding, type UserRole, type SkillLevel } from "@/app/actions/profile";
import { Code2, ShieldAlert, Layers, CheckCircle2, AlertCircle } from "lucide-react";

type RoleChoice = "developer" | "tester" | "both";

const FOCUS_OPTIONS = [
  "Websites and web apps",
  "Mobile apps",
  "APIs",
  "Security and bug bounty",
  "Manual testing",
  "Automated testing",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [choice, setChoice] = React.useState<RoleChoice>("both");
  const [displayName, setDisplayName] = React.useState("");
  const [skillLevel, setSkillLevel] = React.useState<SkillLevel>("intermediate");
  const [focusAreas, setFocusAreas] = React.useState<string[]>(["Websites and web apps"]);
  const [proofUrl, setProofUrl] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [ageConfirmed, setAgeConfirmed] = React.useState(false);
  const [rulesAccepted, setRulesAccepted] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const needsTester = choice === "tester" || choice === "both";

  const toggleFocus = (area: string) => {
    setFocusAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSubmitting(true);

    const roles: UserRole[] =
      choice === "both" ? ["developer", "tester"] : [choice];

    const res = await completeOnboarding({
      displayName,
      roles,
      skillLevel: needsTester ? skillLevel : undefined,
      focusAreas: needsTester ? focusAreas : undefined,
      proofUrl: needsTester ? proofUrl : undefined,
      contact: needsTester ? contact : undefined,
      ageConfirmed: needsTester ? ageConfirmed : undefined,
      rulesAccepted: needsTester ? rulesAccepted : undefined,
    });

    if (!res.success) {
      setErrorMsg(res.error || "Could not save your profile.");
      setSubmitting(false);
      return;
    }

    router.push(res.redirectTo || "/dashboard");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="border-b border-border/70 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-4 sm:px-6">
          <LogoLink href="/" />
          <ThemeToggle />
        </div>
      </header>

      <main className="flex-1 py-10 px-4 sm:px-6">
        <div className="mx-auto max-w-2xl space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
              How will you use Pulse?
            </h1>
            <p className="text-sm text-muted-foreground">
              Choose your role to personalize your workspace. You can change this anytime in your profile.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" role="radiogroup" aria-label="Select your role">
              {[
                {
                  id: "developer" as RoleChoice,
                  title: "Developer",
                  desc: "I build apps and want them monitored and tested.",
                  helper: "Uptime, security scans, error reporting, and test requests.",
                  icon: Code2,
                },
                {
                  id: "tester" as RoleChoice,
                  title: "Tester",
                  desc: "I find bugs and security issues and want to test other people's apps.",
                  helper: "Join approved test programs and submit vulnerability reports.",
                  icon: ShieldAlert,
                },
                {
                  id: "both" as RoleChoice,
                  title: "Both",
                  badge: "Recommended",
                  desc: "Monitor my own apps and test others.",
                  helper: "Full access to both Developer and Tester workspaces.",
                  icon: Layers,
                },
              ].map((item) => {
                const Icon = item.icon;
                const selected = choice === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setChoice(item.id)}
                    className={`text-left rounded-xl border p-4 transition-all focus:outline-none focus:ring-2 focus:ring-primary ${
                      selected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border/70 bg-card hover:border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Icon className={`h-5 w-5 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                      {item.badge && (
                        <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold">
                          {item.badge}
                        </span>
                      )}
                    </div>
                    <div className="font-semibold text-sm text-foreground">{item.title}</div>
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{item.desc}</p>
                    <p className="text-[11px] text-muted-foreground/80 mt-2 pt-2 border-t border-border/50">
                      {item.helper}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Display Name */}
            <Card className="border-border/70">
              <CardContent className="p-5 space-y-4">
                <div>
                  <label htmlFor="displayName" className="block text-xs font-medium text-foreground mb-1.5">
                    Display Name (max 60 characters)
                  </label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    maxLength={60}
                    required
                    placeholder="e.g. Alex Rivera"
                  />
                </div>

                {needsTester && (
                  <div className="space-y-4 pt-3 border-t border-border/60">
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 text-xs text-blue-600 dark:text-blue-400">
                      Tester accounts are reviewed before you can join test programs. You&apos;ll be notified when you&apos;re approved.
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Skill Level
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(["beginner", "intermediate", "advanced"] as SkillLevel[]).map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setSkillLevel(lvl)}
                            className={`rounded-md border px-3 py-2 text-xs font-medium capitalize transition-colors ${
                              skillLevel === lvl
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border/60 bg-background hover:bg-muted/40"
                            }`}
                          >
                            {lvl}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-foreground mb-1.5">
                        Focus Areas
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {FOCUS_OPTIONS.map((area) => {
                          const active = focusAreas.includes(area);
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => toggleFocus(area)}
                              className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                                active
                                  ? "border-primary bg-primary/10 text-primary font-medium"
                                  : "border-border/60 text-muted-foreground hover:text-foreground"
                              }`}
                            >
                              {active && <CheckCircle2 className="inline h-3 w-3 mr-1" />}
                              {area}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label htmlFor="proofUrl" className="block text-xs font-medium text-foreground mb-1.5">
                          Proof of Work Link (optional)
                        </label>
                        <Input
                          id="proofUrl"
                          type="url"
                          value={proofUrl}
                          onChange={(e) => setProofUrl(e.target.value)}
                          maxLength={300}
                          placeholder="https://github.com/..."
                        />
                      </div>
                      <div>
                        <label htmlFor="contact" className="block text-xs font-medium text-foreground mb-1.5">
                          Private Contact (optional)
                        </label>
                        <Input
                          id="contact"
                          value={contact}
                          onChange={(e) => setContact(e.target.value)}
                          maxLength={200}
                          placeholder="Discord, Signal, or email"
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={ageConfirmed}
                          onChange={(e) => setAgeConfirmed(e.target.checked)}
                          className="mt-0.5 rounded border-border"
                        />
                        <span>I confirm I am 18 years old or older.</span>
                      </label>
                      <label className="flex items-start gap-2 text-xs text-foreground cursor-pointer">
                        <input
                          type="checkbox"
                          checked={rulesAccepted}
                          onChange={(e) => setRulesAccepted(e.target.checked)}
                          className="mt-0.5 rounded border-border"
                        />
                        <span>
                          I accept the{" "}
                          <Link href="/terms/testing" target="_blank" className="text-primary underline">
                            testing rules &amp; Safe Harbor terms
                          </Link>
                          .
                        </span>
                      </label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Saving..." : "Continue to Pulse"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}
