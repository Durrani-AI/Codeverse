"use client";

import { usePathname } from "next/navigation";

import { useTheme } from "@/lib/theme-context";
import { cn } from "@/lib/utils";

function SunIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25M12 18.75V21M4.97 4.97l1.59 1.59M17.44 17.44l1.59 1.59M3 12h2.25M18.75 12H21M4.97 19.03l1.59-1.59M17.44 6.56l1.59-1.59" />
      <circle cx="12" cy="12" r="3.5" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3c-.03.25-.04.5-.04.75A9 9 0 0 0 20.25 12c.25 0 .5-.01.75-.04Z" />
    </svg>
  );
}

export function ThemeToggle({ className }: { className?: string }) {
  const { mounted, theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  const label = mounted
    ? isDark
      ? "Switch to light mode"
      : "Switch to dark mode"
    : "Toggle theme";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-surface-border bg-surface-card/90 px-3 py-2 text-sm text-foreground-muted shadow-sm transition-colors",
        "hover:border-brand-400/40 hover:bg-surface-card-hover hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
        className,
      )}
    >
      <span className="flex h-5 w-5 items-center justify-center">
        {isDark ? <SunIcon /> : <MoonIcon />}
      </span>
      <span className="hidden sm:inline">{mounted ? (isDark ? "Light mode" : "Dark mode") : "Theme"}</span>
    </button>
  );
}

export function PublicThemeToggle() {
  const pathname = usePathname();

  const isPublicPage =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");

  if (!isPublicPage) return null;

  return (
    <div className="fixed right-4 top-4 z-50 sm:right-6 sm:top-5">
      <ThemeToggle />
    </div>
  );
}