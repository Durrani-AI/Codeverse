"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

export default function ForgotPasswordPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      const res = await forgotPassword({ email: email.trim().toLowerCase() });
      if (res.ok) {
        setSent(true);
        toast("success", "Check your email for a reset link");
      } else {
        toast("error", "Something went wrong. Try again.");
      }
    } catch {
      toast("error", "Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-6">
        <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-brand-500/[0.03] blur-[100px]" />
        <div className="relative z-10 w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 border border-success/20">
            <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Check Your Email</h1>
          <p className="text-foreground-muted text-sm leading-relaxed">
            If an account with <strong className="text-foreground">{email}</strong> exists,
            we&apos;ve sent a password reset link. The link expires in 1 hour.
          </p>
          <div className="space-y-3 pt-4">
            <Button variant="outline" onClick={() => setSent(false)} className="w-full">
              Try a different email
            </Button>
            <Link
              href="/login"
              className="block text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              ← Back to login
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-brand-500/[0.03] blur-[100px]" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Forgot Password</h1>
          <p className="text-foreground-muted text-sm">
            Enter your email and we&apos;ll send you a reset link
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-foreground-muted">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input w-full"
              placeholder="you@example.com"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
            {loading ? "Sending..." : "Send Reset Link"}
          </Button>
        </form>

        <div className="divider" />

        <p className="text-center text-sm text-foreground-muted">
          Remember your password?{" "}
          <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium transition-colors">
            Sign in
          </Link>
        </p>

        <p className="text-center">
          <Link href="/" className="text-xs text-foreground-muted/60 hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
