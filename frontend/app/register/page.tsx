"use client";

import { useState, useRef, useCallback, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { register as apiRegister } from "@/lib/api";
import { Button } from "@/components/ui";
import { useToast } from "@/components/toast";
import LogoIcon from "@/components/logo-icon";

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (!/[a-zA-Z]/.test(pw)) return "Password must contain at least one letter.";
  if (!/[0-9]/.test(pw)) return "Password must contain at least one number.";
  return null;
}

export default function RegisterPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const showPwTimerRef = useRef<NodeJS.Timeout | null>(null);
  const showConfirmTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleShowPassword = useCallback(() => {
    if (showPwTimerRef.current) clearTimeout(showPwTimerRef.current);
    setShowPassword(true);
    showPwTimerRef.current = setTimeout(() => setShowPassword(false), 2000);
  }, []);

  const handleShowConfirm = useCallback(() => {
    if (showConfirmTimerRef.current) clearTimeout(showConfirmTimerRef.current);
    setShowConfirm(true);
    showConfirmTimerRef.current = setTimeout(() => setShowConfirm(false), 2000);
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !username.trim() || !password || !confirmPassword) {
      const msg = "Please fill in all fields.";
      setError(msg);
      toast("error", msg);
      return;
    }

    if (username.trim().length < 3) {
      const msg = "Username must be at least 3 characters.";
      setError(msg);
      toast("error", msg);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username.trim())) {
      const msg = "Username may only contain letters, digits, _ and -";
      setError(msg);
      toast("error", msg);
      return;
    }

    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      toast("error", pwError);
      return;
    }

    if (password !== confirmPassword) {
      const msg = "Passwords do not match.";
      setError(msg);
      toast("error", msg);
      return;
    }

    setLoading(true);
    try {
      const res = await apiRegister({
        email: email.trim(),
        username: username.trim(),
        password,
      });
      if (!res.ok) {
        const errData = res.data as unknown as { detail?: string };
        const msg = errData?.detail ?? "Registration failed. Username or email may already be taken.";
        setError(msg);
        toast("error", msg);
        return;
      }
      toast("success", "Account created! Redirecting to login...");
      router.push("/login?registered=1");
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : "Registration failed. Please try again.";
      if (typeof err === "object" && err !== null && "response" in err) {
        const axErr = err as { response?: { data?: { detail?: string } } };
        const detail = axErr.response?.data?.detail ?? msg;
        setError(detail);
        toast("error", detail);
      } else {
        setError(msg);
        toast("error", msg);
      }
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
          <div className="flex justify-center mb-2">
            <LogoIcon size={48} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Create Account</h1>
          <p className="text-foreground-muted text-sm">
            Join Codeverse and start practicing
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
              htmlFor="email"
              className="block text-sm font-medium text-foreground-muted"
            >
              Email
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
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-foreground-muted"
            >
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input w-full pr-24"
                placeholder="--------"
              />
              <button
                type="button"
                onClick={handleShowConfirm}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium px-2.5 py-1 rounded-md bg-surface-card border border-surface-border text-foreground-muted hover:text-foreground transition-colors"
              >
                {showConfirm ? "Visible" : "Show"}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            isLoading={loading}
          >
            {loading ? "Creating account..." : "Create Account"}
          </Button>
        </form>

        {/* Divider */}
        <div className="divider" />

        {/* Footer */}
        <p className="text-center text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-brand-400 hover:text-brand-300 font-medium transition-colors"
          >
            Sign in
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
