"use client";

import * as React from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { User, Bell, Sliders, Shield, Save, CheckCircle2 } from "lucide-react";

export default function SettingsPage() {
  const [saved, setSaved] = React.useState(false);

  // Profile form state
  const [fullName, setFullName] = React.useState("Alex Rivera");
  const [email, setEmail] = React.useState("alex@acmepay.io");
  const [company, setCompany] = React.useState("Acme Pay Inc.");

  // Notification settings
  const [emailAlerts, setEmailAlerts] = React.useState(true);
  const [slackWebhook, setSlackWebhook] = React.useState("https://hooks.slack.com/services/T00/B00/XXXX");
  const [discordWebhook, setDiscordWebhook] = React.useState("");
  const [downConsecutive, setDownConsecutive] = React.useState("2");

  // Account Preferences
  const [timezone, setTimezone] = React.useState("UTC (Coordinated Universal Time)");
  const [retentionDays, setRetentionDays] = React.useState("90");

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
    }, 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Account & System Settings
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Manage your user profile, alerting channels, and account preferences.
          </p>
        </div>

        {saved && (
          <div className="inline-flex items-center gap-1.5 text-xs text-emerald-500 font-medium">
            <CheckCircle2 className="h-4 w-4" /> Changes saved successfully!
          </div>
        )}
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications & Alerts</TabsTrigger>
          <TabsTrigger value="preferences">Account Preferences</TabsTrigger>
        </TabsList>

        {/* PROFILE TAB */}
        <TabsContent value="profile">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">User Profile</CardTitle>
                <CardDescription className="text-xs">
                  Your personal identity and administrative organization credentials
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Full Name
                  </label>
                  <Input
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Work Email
                  </label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Organization Name
                  </label>
                  <Input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/60 pt-4 flex justify-end">
                <Button type="submit" size="sm" className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save Profile
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        {/* NOTIFICATIONS TAB */}
        <TabsContent value="notifications">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Notification Channels</CardTitle>
                <CardDescription className="text-xs">
                  Where and when Pulse notifies your team during incidents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Email Incident Notifications
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Send instantaneous alerts to {email} when endpoints fail
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={emailAlerts}
                    onChange={(e) => setEmailAlerts(e.target.checked)}
                    className="h-4 w-4 rounded border-border"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Slack Incoming Webhook URL
                  </label>
                  <Input
                    value={slackWebhook}
                    onChange={(e) => setSlackWebhook(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Direct incident escalation alerts into your team's on-call channel.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Discord Webhook URL (Optional)
                  </label>
                  <Input
                    value={discordWebhook}
                    onChange={(e) => setDiscordWebhook(e.target.value)}
                    placeholder="https://discord.com/api/webhooks/..."
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Incident Trigger Threshold
                  </label>
                  <select
                    value={downConsecutive}
                    onChange={(e) => setDownConsecutive(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="1">1 failed check (Immediate alert)</option>
                    <option value="2">2 consecutive failed checks (Recommended to avoid false positives)</option>
                    <option value="3">3 consecutive failed checks</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/60 pt-4 flex justify-end">
                <Button type="submit" size="sm" className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save Alert Rules
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        {/* ACCOUNT PREFERENCES TAB */}
        <TabsContent value="preferences">
          <form onSubmit={handleSave}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-semibold">Account Preferences</CardTitle>
                <CardDescription className="text-xs">
                  Display preferences, system telemetry retention, and regional time standards
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Interface Theme
                  </label>
                  <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <span className="text-xs text-muted-foreground">
                      Toggle between Dark, Light, and System Theme
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Reporting Timezone
                  </label>
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="UTC (Coordinated Universal Time)">UTC (Coordinated Universal Time)</option>
                    <option value="America/New_York (EST/EDT)">America/New_York (EST/EDT)</option>
                    <option value="America/Los_Angeles (PST/PDT)">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London (GMT/BST)">Europe/London (GMT/BST)</option>
                    <option value="Asia/Tokyo (JST)">Asia/Tokyo (JST)</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Telemetry Data Retention
                  </label>
                  <select
                    value={retentionDays}
                    onChange={(e) => setRetentionDays(e.target.value)}
                    className="h-9 w-full rounded-md border border-input bg-card px-3 text-xs text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="30">30 days (Free tier)</option>
                    <option value="90">90 days (Pro tier - active)</option>
                    <option value="365">365 days (Enterprise tier)</option>
                  </select>
                </div>
              </CardContent>
              <CardFooter className="border-t border-border/60 pt-4 flex justify-end">
                <Button type="submit" size="sm" className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Save Preferences
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>
      </Tabs>
    </div>
  );
}
