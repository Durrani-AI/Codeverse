/*    Button – reusable, accessible button with variants, sizes & states
   
   Variants : primary · secondary · outline · ghost
   Sizes    : sm · md · lg
   States   : loading (shows Spinner) · disabled
   ARIA     : aria-busy while loading, aria-disabled when disabled */

"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

// Types

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. @default "primary" */
  variant?: ButtonVariant;
  /** Size preset. @default "md" */
  size?: ButtonSize;
  /** Show a loading spinner & disable interaction. */
  isLoading?: boolean;
  /** Optional text shown when loading (replaces children). */
  loadingText?: string;
  /** Render as full-width block element. */
  fullWidth?: boolean;
}

// Variant classes

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-500 focus-visible:ring-brand-500 " +
    "active:bg-brand-700 hover:shadow-[0_0_20px_rgba(139,92,246,0.25)]",
  secondary:
    "bg-surface-card text-foreground hover:bg-surface-card-hover " +
    "focus-visible:ring-brand-500 border border-surface-border",
  outline:
    "bg-transparent text-foreground border border-surface-border " +
    "hover:border-brand-400/50 hover:text-brand-300 hover:shadow-[0_0_16px_rgba(139,92,246,0.08)] focus-visible:ring-brand-500",
  ghost:
    "bg-transparent text-foreground-muted hover:bg-white/[0.04] " +
    "hover:text-foreground focus-visible:ring-brand-500",
};

// Size classes

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm gap-1.5 rounded-md",
  md: "px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "px-6 py-3 text-base gap-2.5 rounded-lg",
};

// Spinner size mapping

const spinnerSizeMap: Record<ButtonSize, "sm" | "md" | "lg"> = {
  sm: "sm",
  md: "sm",
  lg: "md",
};

// Component

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      isLoading = false,
      fullWidth = false,
      disabled,
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const isDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-busy={isLoading || undefined}
        aria-disabled={isDisabled || undefined}
        className={cn(
          // Base styles shared by all buttons
          "relative inline-flex items-center justify-center font-medium",
          "transition-colors duration-150 ease-in-out",
          "select-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
          "focus-visible:ring-offset-surface",
          // Disabled / loading state
          isDisabled && "opacity-50 cursor-not-allowed pointer-events-none",
          // Variant + size
          variantClasses[variant],
          sizeClasses[size],
          // Full width
          fullWidth && "w-full",
          // Caller overrides
          className,
        )}
        {...rest}
      >
        {/* Spinner overlays centered – does NOT push text */}
        {isLoading && (
          <span className="absolute inset-0 flex items-center justify-center">
            <Spinner
              size={spinnerSizeMap[size]}
              className={cn(
                "shrink-0",
                variant === "primary" && "!border-white/30 !border-t-white",
              )}
            />
          </span>
        )}

        {/* Text becomes invisible (but still occupies space) while loading */}
        <span className={cn(isLoading && "invisible")}>
          {children}
        </span>
      </button>
    );
  },
);

Button.displayName = "Button";

