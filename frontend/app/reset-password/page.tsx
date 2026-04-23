"use client";

import { useState, useRef, useCallback, type FormEvent, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { resetPassword } from "@/lib/api";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const { toast } = useToast();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const showTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleShowPassword = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    setShowPassword(true);
    showTimerRef.current = setTimeout(() => setShowPassword(false), 2000);
  }, []);

  if (!token) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-6">
        <div className="relative z-10 w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-danger/10 border border-danger/20">
            <svg className="h-8 w-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Invalid Reset Link</h1>
          <p className="text-foreground-muted text-sm">
            This link is missing or malformed. Please request a new one.
          </p>
          <Link href="/forgot-password" className="block text-brand-400 hover:text-brand-300 text-sm font-medium transition-colors">
            Request new reset link →
          </Link>
        </div>
      </main>
    );
  }

  if (success) {
    return (
      <main className="relative flex min-h-screen items-center justify-center px-6">
        <div className="relative z-10 w-full max-w-md space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/10 border border-success/20">
            <svg className="h-8 w-8 text-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold">Password Reset</h1>
          <p className="text-foreground-muted text-sm">
            Your password has been updated. You can now sign in.
          </p>
          <Link href="/login">
            <Button variant="primary" size="lg" className="w-full mt-4">
              Go to Login
            </Button>
          </Link>
        </div>
      </main>
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (!/[a-zA-Z]/.test(password)) {
      setError("Password must contain at least one letter");
      return;
    }
    if (!/[0-9]/.test(password)) {
      setError("Password must contain at least one number");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPassword({ token, new_password: password });
      if (res.ok) {
        setSuccess(true);
        toast("success", "Password reset successfully");
      } else {
        const data = res.data as unknown as { detail?: string };
        const msg = data?.detail || "Invalid or expired token";
        setError(msg);
        toast("error", msg);
      }
    } catch {
      setError("Something went wrong. Please try again.");
      toast("error", "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-brand-500/[0.03] blur-[100px]" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Reset Password</h1>
          <p className="text-foreground-muted text-sm">
            Enter your new password below
          </p>
        </div>

        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-foreground-muted">
              New Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input w-full pr-24"
                placeholder="--------"
              />
              <button
                type="button"
                onClick={handleShowPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2.5 py-1 rounded-md bg-surface-card border border-surface-border text-foreground-muted hover:text-foreground transition-colors"
              >
                {showPassword ? "Visible" : "Show"}
              </button>
            </div>
            <ul className="text-xs text-foreground-muted/70 space-y-0.5 pl-1">
              <li className={password.length >= 8 ? "text-success" : ""}>• At least 8 characters</li>
              <li className={/[a-zA-Z]/.test(password) ? "text-success" : ""}>• At least one letter</li>
              <li className={/[0-9]/.test(password) ? "text-success" : ""}>• At least one number</li>
            </ul>
          </div>

          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground-muted">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input w-full"
              placeholder="--------"
            />
          </div>

          <Button type="submit" variant="primary" size="lg" className="w-full" isLoading={loading}>
            {loading ? "Resetting..." : "Reset Password"}
          </Button>
        </form>

        <div className="divider" />

        <p className="text-center">
          <Link href="/login" className="text-xs text-foreground-muted/60 hover:text-foreground transition-colors">
            ← Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-pulse text-foreground-muted">Loading...</div>
      </main>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
