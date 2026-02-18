/* ═══════════════════════════════════════════════════════════════════════════
   InterviewCard – displays a single interview session in a card layout
   ═══════════════════════════════════════════════════════════════════════════
   Shows : interview_type · difficulty_level · status badge
           started_at + computed duration · score (if completed)
   Actions : Resume (in_progress) · View Details (completed)
   Layout  : responsive – stacks on mobile, horizontal on desktop
   ═══════════════════════════════════════════════════════════════════════════ */

"use client";

import type { InterviewSession } from "@/types";
import { cn, formatDate, formatInterviewType, formatStatus, statusVariant } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface InterviewCardProps {
  /** The interview session data to render. */
  session: InterviewSession;
  /** Called when the user clicks "Resume" (only for in_progress sessions). */
  onResume?: (sessionId: string) => void;
  /** Called when the user clicks "View Details" (only for completed sessions). */
  onViewDetails?: (sessionId: string) => void;
  /** Called when the user clicks "Cancel" (only for in_progress sessions). */
  onCancel?: (sessionId: string) => void;
  /** Extra Tailwind classes for the outer wrapper. */
  className?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Compute a human-readable duration between two ISO date strings. */
function computeDuration(start: string, end: string | null): string {
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  const diffMs = Math.max(0, endMs - startMs);

  const totalSeconds = Math.floor(diffMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

/** Map difficulty to a colour-coded class. */
function difficultyColor(level: string): string {
  switch (level) {
    case "easy":
      return "text-success";
    case "medium":
      return "text-warning";
    case "hard":
      return "text-danger";
    default:
      return "text-foreground-muted";
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function InterviewCard({
  session,
  onResume,
  onViewDetails,
  onCancel,
  className,
}: InterviewCardProps) {
  const {
    id,
    interview_type,
    difficulty_level,
    status,
    started_at,
    completed_at,
    questions_count,
    topic,
  } = session;

  const isInProgress = status === "in_progress";
  const isCompleted = status === "completed";

  return (
    <article
      className={cn(
        "glass group flex flex-col gap-4 p-5",
        "transition-all duration-300 hover:border-brand-500/25",
        "hover:shadow-[0_0_20px_rgba(139,92,246,0.05)]",
        className,
      )}
      aria-label={`${formatInterviewType(interview_type)} interview – ${formatStatus(status)}`}
    >
      {/* ── Header row ─────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-3">
        {/* Left: type + topic */}
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-foreground truncate">
            {formatInterviewType(interview_type)}
          </h3>

          {topic && (
            <p className="mt-0.5 text-sm text-foreground-muted truncate">
              {topic}
            </p>
          )}
        </div>

        {/* Right: status badge */}
        <Badge variant={statusVariant(status)}>{formatStatus(status)}</Badge>
      </div>

      {/* ── Meta row ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-foreground-muted">
        {/* Difficulty */}
        <span className="flex items-center gap-1">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
          <span className={difficultyColor(difficulty_level)}>
            {difficulty_level.charAt(0).toUpperCase() + difficulty_level.slice(1)}
          </span>
        </span>

        {/* Date */}
        <span className="flex items-center gap-1">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          {formatDate(started_at)}
        </span>

        {/* Duration */}
        <span className="flex items-center gap-1">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {computeDuration(started_at, completed_at)}
        </span>

        {/* Questions count */}
        <span className="flex items-center gap-1">
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {questions_count} question{questions_count !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ── Action row ─────────────────────────────────────────────────── */}
      <div className="mt-auto flex flex-wrap items-center gap-2 pt-3 border-t border-surface-border/40">
        {isInProgress && onResume && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => onResume(id)}
          >
            Resume
          </Button>
        )}

        {isInProgress && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onCancel(id)}
            className="text-danger hover:text-danger"
          >
            Cancel
          </Button>
        )}

        {isCompleted && onViewDetails && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(id)}
          >
            View Details
          </Button>
        )}

        {/* Score chip (completed sessions only – score lives in feedback, */}
        {/* so we show a placeholder; parent can pass it in via children).  */}
      </div>
    </article>
  );
}
