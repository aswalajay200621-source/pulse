"use client";

import * as React from "react";
import Link from "next/link";
import { LogoLink } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { ArrowLeft, CheckCircle2 } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSubmitted(true);
    }, 500);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between px-6 border-b border-border/40">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign in
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
              Reset your password
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Enter your email and we'll send you recovery instructions.
            </p>
          </div>

          <Card className="border-border/80 shadow-md">
            {submitted ? (
              <CardContent className="space-y-4 pt-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">
                    Check your inbox
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    If an account exists for <span className="font-mono font-medium text-foreground">{email}</span>, we have sent a secure password reset link.
                  </p>
                </div>
                <div className="pt-2">
                  <Link href="/login">
                    <Button variant="outline" className="w-full">
                      Return to Sign In
                    </Button>
                  </Link>
                </div>
              </CardContent>
            ) : (
              <form onSubmit={handleSubmit}>
                <CardContent className="space-y-4 pt-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">
                      Email address
                    </label>
                    <Input
                      type="email"
                      required
                      placeholder="alex@acmepay.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </CardContent>

                <CardFooter className="flex flex-col gap-3">
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? "Sending..." : "Send Password Reset Link"}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground">
                    Remember your credentials?{" "}
                    <Link
                      href="/login"
                      className="font-medium text-foreground underline-offset-4 hover:underline"
                    >
                      Sign in
                    </Link>
                  </p>
                </CardFooter>
              </form>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
