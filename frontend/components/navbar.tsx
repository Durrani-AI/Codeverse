"use client";

/* ═══════════════════════════════════════════════════════════════════════════
   Navbar – persistent top navigation shown on authenticated pages
   ═══════════════════════════════════════════════════════════════════════════ */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const navLinks = [
  { href: "/dashboard", label: "Dashboard" },
] as const;

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const pathname = usePathname();

  // Only show navbar on authenticated app pages (not landing, login, register)
  const isPublicPage = pathname === "/" || pathname.startsWith("/login") || pathname.startsWith("/register");
  if (!isAuthenticated || isPublicPage) return null;

  return (
    <header className="sticky top-0 z-50 border-b border-surface-border/40 bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Left – brand + nav links */}
        <div className="flex items-center gap-6">
          <Link
            href="/dashboard"
            className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600/20 text-brand-400 text-sm">
              AI
            </span>
            <span className="hidden sm:inline">Interview Coach</span>
          </Link>

          <nav className="flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200",
                  pathname === href
                    ? "bg-brand-500/10 text-brand-400"
                    : "text-foreground-muted hover:text-foreground hover:bg-white/[0.04]",
                )}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right – user info + sign out */}
        <div className="flex items-center gap-4">
          {user && (
            <span className="hidden text-sm text-foreground-muted/80 sm:inline">
              {user.username}
            </span>
          )}
          <button
            onClick={logout}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground-muted/70 transition-all duration-200 hover:text-danger hover:bg-danger/10"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
}
