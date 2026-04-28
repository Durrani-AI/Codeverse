"use client";

import { useState, useRef, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { login as apiLogin, setToken } from "@/lib/api";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const showTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleShowPassword = useCallback(() => {
    if (showTimerRef.current) clearTimeout(showTimerRef.current);
    setShowPassword(true);
    showTimerRef.current = setTimeout(() => setShowPassword(false), 2000);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      const msg = "Please fill in all fields.";
      setError(msg);
      toast("error", msg);
      return;
    }

    setLoading(true);
    try {
      const res = await apiLogin({ username: username.trim(), password });
      if (!res.ok) {
        const errData = res.data as unknown as { detail?: string };
        const msg = errData?.detail ?? "Invalid username or password.";
        setError(msg);
        toast("error", msg);
        return;
      }

      // Keep token in memory only as a fallback if browser blocks cross-site cookies.
      if (res.data?.access_token) {
        setToken(res.data.access_token);
      }

      const redirected = await login();
      if (redirected) {
        toast("success", "Signed in successfully");
        router.replace("/dashboard");
      }
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(msg);
      toast("error", msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center px-6">
      {/* Background glow */}
      <div aria-hidden className="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] h-[420px] rounded-full bg-brand-500/[0.03] blur-[100px]" />

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold tracking-tight">Welcome Back</h1>
          <p className="text-foreground-muted text-sm">
            Sign in to continue on Codeverse
          </p>
        </div>

        {/* Error banner */}
        {error && (
          <div className="rounded-lg bg-danger/10 border border-danger/30 px-4 py-3 text-sm text-danger">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-foreground-muted"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input w-full"
              placeholder="johndoe"
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-foreground-muted"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
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
          </div>

          <div className="flex justify-end">
            <Link
              href="/forgot-password"
              className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
            >
              Forgot password?
            </Link>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={loading}
          >
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        {/* Divider */}
        <div className="divider" />

        {/* Footer */}
        <p className="text-center text-sm text-foreground-muted">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
          >
            Create one
          </Link>
        </p>

        <p className="text-center">
          <Link
            href="/"
            className="text-xs text-foreground-muted/60 hover:text-foreground transition-colors"
          >
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
