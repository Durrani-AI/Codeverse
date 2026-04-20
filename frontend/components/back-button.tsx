"use client";

/*    BackButton - reusable navigation component that goes to the previous page
   
   Uses router.back() by default. If `href` is provided, navigates there instead.
   Renders as a subtle link-style button at the top of the page. */

import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** Optional fixed href to navigate to instead of router.back() */
  href?: string;
  /** Custom label. @default "Back" */
  label?: string;
  /** Extra Tailwind classes. */
  className?: string;
}

export default function BackButton({ href, label = "Back", className }: BackButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (href) {
      router.push(href);
    } else {
      router.back();
    }
  }

  return (
    <button
      onClick={handleClick}
      className={cn(
        "inline-flex items-center gap-1.5 text-sm text-foreground-muted/60",
        "hover:text-foreground transition-colors mb-4",
        className,
      )}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-4 w-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  );
}
