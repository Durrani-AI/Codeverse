/*  Skeleton - shimmer loading placeholder component.

    Usage:
      <Skeleton className="h-8 w-64" />           // line
      <Skeleton variant="circle" className="h-12 w-12" />  // avatar
      <Skeleton variant="card" className="h-44" />  // card block
*/

import React from "react";
import { cn } from "@/lib/utils";

interface SkeletonProps {
  variant?: "line" | "circle" | "card";
  className?: string;
  children?: React.ReactNode;
}

const baseClasses =
  "relative overflow-hidden bg-surface-card before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-white/[0.04] before:to-transparent before:animate-[shimmer_2s_ease-in-out_infinite]";

const variantClasses = {
  line: "rounded",
  circle: "rounded-full",
  card: "rounded border border-surface-border/40",
};

export function Skeleton({ variant = "line", className, children }: SkeletonProps) {
  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      role="status"
      aria-label="Loading"
    >
      {children}
    </div>
  );
}
