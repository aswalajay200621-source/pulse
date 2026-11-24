"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogoLink } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = React.useState("Alex Rivera");
  const [company, setCompany] = React.useState("Acme Pay");
  const [email, setEmail] = React.useState("alex@acmepay.io");
  const [password, setPassword] = React.useState("SecurePass123!");
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      router.push("/dashboard");
    }, 600);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-6 border-b border-border/40">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </Link>
        <ThemeToggle />
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="flex justify-center mb-3">
              <LogoLink href="/" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create your Pulse account
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Start monitoring your production services in less than 3 minutes.
            </p>
          </div>

          <Card className="border-border/80 shadow-md">
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-3.5 pt-6">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Full Name
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="Alex Rivera"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Organization or Company
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="Acme Pay Inc."
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Work Email
                  </label>
                  <Input
                    type="email"
                    required
                    placeholder="alex@acmepay.io"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    Password
                  </label>
                  <Input
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Must be at least 8 characters with letters & numbers.
                  </p>
                </div>

                <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                  <div className="flex items-center gap-1.5 text-foreground font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    Free 14-day Pro trial included
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Unlimited monitors, security headers scanner & automated alerts.
                  </p>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating Account..." : "Create Free Account"}
                </Button>

                <p className="text-center text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <Link
                    href="/login"
                    className="font-medium text-foreground underline-offset-4 hover:underline"
                  >
                    Sign in
                  </Link>
                </p>

                <p className="text-center text-[11px] text-muted-foreground/80 leading-relaxed">
                  By signing up, you agree to Pulse's{" "}
                  <Link href="/terms" className="underline hover:text-foreground">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="underline hover:text-foreground">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
}
