/* Utility helpers for the frontend */

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely (handles conflicts like px-2 + px-4). */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(...inputs));
}

/** Format an ISO-8601 date string to a human-readable form. */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Capitalize first letter of a string. */
export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Format an interview type for display (e.g. "system_design" -> "System Design"). */
export function formatInterviewType(type: string): string {
  return type
    .split("_")
    .map((w) => capitalize(w))
    .join(" ");
}

/** Return a CSS color based on score value. */
export function scoreColor(score: number): string {
  if (score >= 7) return "text-success";
  if (score >= 5) return "text-warning";
  return "text-danger";
}

/** Return badge variant class based on session status. */
export function statusVariant(status: string): "success" | "warning" | "danger" | "default" {
  switch (status) {
    case "completed":
      return "success";
    case "in_progress":
      return "warning";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
}

/** Format status for display. */
export function formatStatus(status: string): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return capitalize(status);
  }
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
