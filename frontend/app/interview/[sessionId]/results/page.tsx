   Interview Results – post-interview analysis & review page
   - Overall score with circular progress indicator
   - Question list with user responses & AI feedback (strengths + improvements)
   - Performance breakdown by topic / question type
   - Comparison with previous interviews (visual bar chart)
   - "Start Another Interview" button
   - Share & Print / Export functionality
   - Fully responsive with TypeScript

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  AnalyticsOverview,
  InterviewSession,
  SessionFeedbackResponse,
} from "@/types";
import {
  getAnalyticsOverview,
  getSession,
  getSessionFeedback,
  listSessions,
} from "@/lib/api";
import {
  cn,
  formatDate,
  formatInterviewType,
  scoreColor,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import ProtectedRoute from "@/components/protected-route";

// Types

interface ResultsState {
  session: InterviewSession | null;
  feedback: SessionFeedbackResponse | null;
  analytics: AnalyticsOverview | null;
  previousScores: number[];
  loading: boolean;
  error: string | null;
}

// Circular progress component

interface CircularScoreProps {
  score: number;
  maxScore?: number;
  size?: number;
}

function CircularScore({ score, maxScore = 10, size = 160 }: CircularScoreProps) {
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(score / maxScore, 1);
  const offset = circumference * (1 - pct);

  const color =
    score >= 7 ? "stroke-success" : score >= 5 ? "stroke-warning" : "stroke-danger";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="rotate-[-90deg]">
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-surface-border/60"
          strokeWidth={8}
        />
        {/* Progress ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={color}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
        />
      </svg>
      {/* Score text centred */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={cn("text-4xl font-bold", scoreColor(score))}>
          {score.toFixed(1)}
        </span>
        <span className="text-xs text-foreground-muted">out of {maxScore}</span>
      </div>
    </div>
  );
}

// Simple horizontal bar chart for comparison

interface BarChartProps {
  data: { label: string; value: number; highlight?: boolean }[];
  maxValue?: number;
}

function HorizontalBarChart({ data, maxValue = 10 }: BarChartProps) {
  return (
    <div className="space-y-3">
      {data.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className={item.highlight ? "text-foreground font-medium" : "text-foreground-muted"}>
              {item.label}
            </span>
            <span className={cn("font-semibold", scoreColor(item.value))}>
              {item.value.toFixed(1)}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-surface-border/50 overflow-hidden">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all duration-700",
                item.highlight ? "bg-brand-500" : "bg-foreground-muted/40",
                item.value >= 7 ? "bg-success" : item.value >= 5 ? "bg-warning" : "bg-danger",
              )}
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Page component

export default function InterviewResultsPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  const [state, setState] = useState<ResultsState>({
    session: null,
    feedback: null,
    analytics: null,
    previousScores: [],
    loading: true,
    error: null,
  });
  const [expandedQ, setExpandedQ] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch all data on mount

  useEffect(() => {
    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const [sessionRes, feedbackRes, analyticsRes, sessionsRes] = await Promise.all([
          getSession(sessionId),
          getSessionFeedback(sessionId),
          getAnalyticsOverview(),
          listSessions(),
        ]);

        if (!sessionRes.ok || !feedbackRes.ok) {
          setState((s) => ({
            ...s,
            loading: false,
            error: "Failed to load interview results.",
          }));
          return;
        }

        // Gather scores from completed previous sessions for comparison
        const prevScores: number[] = [];
        if (sessionsRes.ok) {
          for (const sess of sessionsRes.data) {
            if (sess.status === "completed" && sess.id !== sessionId) {
              // We don't have per-session scores from the list endpoint,
              // but individual_scores from this session's feedback suffice.
              // For comparison, we use analytics by_type averages.
            }
          }
        }

        setState({
          session: sessionRes.data,
          feedback: feedbackRes.data,
          analytics: analyticsRes.ok ? analyticsRes.data : null,
          previousScores: prevScores,
          loading: false,
          error: null,
        });
      } catch {
        setState((s) => ({
          ...s,
          loading: false,
          error: "Something went wrong loading the results.",
        }));
      }
    }

    load();
  }, [sessionId, router]);

  // Share handler

  const handleShare = useCallback(async () => {
    const shareData = {
      title: "AI Interview Results",
      text: state.feedback
        ? `I scored ${state.feedback.overall_score?.toFixed(1) ?? "—"}/10 on my ${state.session ? formatInterviewType(state.session.interview_type) : ""} interview!`
        : "Check out my interview results!",
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
    } else {
      // Fallback: copy URL to clipboard
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [state.feedback, state.session]);

  // Print / export

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

  // Derived data

  const feedback = state.feedback;
  const session = state.session;

  // Per-question scores for breakdown
  const individualScores = useMemo(() => {
    if (!feedback) return [];
    return feedback.individual_scores.map((s, i) => ({
      label: `Question ${i + 1}`,
      value: s ?? 0,
      highlight: false,
    }));
  }, [feedback]);

  // Comparison data from analytics by_type
  const comparisonData = useMemo(() => {
    if (!state.analytics || !session) return [];
    const entries = state.analytics.by_type.map((t) => ({
      label: formatInterviewType(t.interview_type),
      value: t.average_score,
      highlight: t.interview_type === session.interview_type,
    }));
    // Add this session
    if (feedback?.overall_score) {
      entries.push({
        label: "This Session",
        value: feedback.overall_score,
        highlight: true,
      });
    }
    return entries;
  }, [state.analytics, session, feedback]);

  // Loading

  if (state.loading) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 flex flex-col items-center gap-4 pt-32">
          <Spinner size="lg" />
          <p className="text-foreground-muted text-sm">Loading results…</p>
        </main>
      </ProtectedRoute>
    );
  }

  // Error

  if (state.error || !feedback || !session) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="glass flex flex-col items-center gap-4 py-16 text-center">
            <div className="text-3xl text-danger">!</div>
            <h2 className="text-xl font-semibold text-foreground">
              {state.error ?? "Results not available"}
            </h2>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const overallScore = feedback.overall_score ?? 0;

  return (
    <ProtectedRoute>
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 space-y-10 animate-fade-in print:p-0">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <button
            onClick={() => router.push("/dashboard")}
            className="text-sm text-foreground-muted/60 hover:text-foreground transition-all mb-2 flex items-center gap-1"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {formatInterviewType(session.interview_type)} Results
          </h1>
          <p className="text-sm text-foreground-muted mt-1">
            {formatDate(session.started_at)} · {session.difficulty_level.charAt(0).toUpperCase() + session.difficulty_level.slice(1)}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="ghost" size="sm" onClick={handleShare}>
            {copied ? "✓ Copied!" : "Share"}
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint}>
            Print / Export
          </Button>
        </div>
      </header>

      {/* Score overview */}
      <section className="glass p-8 flex flex-col md:flex-row items-center gap-8">
        <CircularScore score={overallScore} />

        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Overall Performance</h2>
            <p className="text-foreground-muted text-sm mt-1 max-w-lg leading-relaxed">
              {feedback.summary}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-foreground">{feedback.questions_answered}</p>
              <p className="text-xs text-foreground-muted">Questions Answered</p>
            </div>
            <div>
              <p className={cn("text-2xl font-bold", scoreColor(overallScore))}>
                {overallScore.toFixed(1)}
              </p>
              <p className="text-xs text-foreground-muted">Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">
                {feedback.individual_scores.filter((s) => s !== null && s >= 7).length}
              </p>
              <p className="text-xs text-foreground-muted">Strong Answers</p>
            </div>
          </div>
        </div>
      </section>

      {/* Key strengths & improvements */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Strengths */}
        <section className="glass p-6 border-l-[3px] border-l-success space-y-3">
          <h3 className="text-base font-semibold text-success flex items-center gap-2">
            <span>✓</span> Key Strengths
          </h3>
          {feedback.key_strengths.length > 0 ? (
            <ul className="space-y-2">
              {feedback.key_strengths.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 text-success shrink-0">-</span>
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground-muted">No strengths recorded.</p>
          )}
        </section>

        {/* Improvements */}
        <section className="glass p-6 border-l-[3px] border-l-warning space-y-3">
          <h3 className="text-base font-semibold text-warning flex items-center gap-2">
            <span>△</span> Areas for Improvement
          </h3>
          {feedback.areas_for_improvement.length > 0 ? (
            <ul className="space-y-2">
              {feedback.areas_for_improvement.map((s, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                  <span className="mt-0.5 text-warning shrink-0">-</span>
                  {s}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-foreground-muted">No improvement areas recorded.</p>
          )}
        </section>
      </div>

      {/* Recommendations */}
      {feedback.recommendations.length > 0 && (
        <section className="glass p-6 space-y-3">
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            Recommendations
          </h3>
          <ul className="space-y-2">
            {feedback.recommendations.map((r, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 text-brand-400 shrink-0">{i + 1}.</span>
                {r}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Per-question breakdown */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold text-foreground tracking-tight">Question Breakdown</h3>

        {(feedback.question_feedbacks ?? []).length > 0 ? (
          <div className="space-y-3">
            {feedback.question_feedbacks.map((qf, idx) => {
              const qScore = qf.score ?? null;
              const isExpanded = expandedQ === idx;

              return (
                <div key={idx} className="card overflow-hidden">
                  {/* Collapsed header */}
                  <button
                    type="button"
                    onClick={() => setExpandedQ(isExpanded ? null : idx)}
                    className="w-full flex items-center justify-between gap-3 text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface text-xs font-semibold text-foreground-muted border border-surface-border">
                        {idx + 1}
                      </span>
                      <p className="text-sm text-foreground truncate">{qf.question_text}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {qScore !== null && (
                        <span className={cn("text-sm font-bold", scoreColor(qScore))}>
                          {qScore}/10
                        </span>
                      )}
                      <svg
                        className={cn("h-4 w-4 text-foreground-muted transition-transform", isExpanded && "rotate-180")}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="mt-4 space-y-4 border-t border-surface-border pt-4 animate-fade-in">
                      {/* Full question */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground-muted">Question</p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{qf.question_text}</p>
                      </div>

                      {/* Score bar */}
                      {qScore !== null && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground-muted">Score</p>
                          <div className="flex items-center gap-3">
                            <div className="h-2 flex-1 rounded-full bg-surface-border overflow-hidden">
                              <div
                                className={cn(
                                  "h-2 rounded-full transition-all duration-500",
                                  qScore >= 7 ? "bg-success" : qScore >= 5 ? "bg-warning" : "bg-danger",
                                )}
                                style={{ width: `${(qScore / 10) * 100}%` }}
                              />
                            </div>
                            <span className={cn("text-sm font-bold", scoreColor(qScore))}>
                              {qScore}/10
                            </span>
                          </div>
                        </div>
                      )}

                      {/* AI Feedback */}
                      {qf.ai_feedback_text && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-foreground-muted">AI Feedback</p>
                          <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                            {qf.ai_feedback_text}
                          </p>
                        </div>
                      )}

                      {/* Strengths */}
                      {qf.strengths && qf.strengths.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-success">Strengths</p>
                          <ul className="space-y-1">
                            {qf.strengths.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                <span className="mt-0.5 text-success shrink-0">-</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Areas to improve */}
                      {qf.improvements && qf.improvements.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-warning">Areas to Improve</p>
                          <ul className="space-y-1">
                            {qf.improvements.map((s, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-foreground">
                                <span className="mt-0.5 text-warning shrink-0">-</span>
                                {s}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="card text-center py-8">
            <p className="text-sm text-foreground-muted">No questions available for this session.</p>
          </div>
        )}
      </section>

      {/* Performance breakdown – bar chart */}
      {individualScores.length > 0 && (
        <section className="glass p-6 space-y-4">
          <h3 className="text-base font-semibold text-foreground">Score by Question</h3>
          <HorizontalBarChart data={individualScores} />
        </section>
      )}

      {/* Comparison with previous interviews */}
      {comparisonData.length > 1 && (
        <section className="glass p-6 space-y-4">
          <h3 className="text-base font-semibold text-foreground">
            Comparison with Previous Interviews
          </h3>
          <p className="text-sm text-foreground-muted">
            Average scores across interview types vs. this session.
          </p>
          <HorizontalBarChart data={comparisonData} />
        </section>
      )}

      {/* Action buttons */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4 py-4 print:hidden">
        <Button variant="primary" size="lg" onClick={() => router.push("/dashboard")}>
          Try Again →
        </Button>
        <Button variant="outline" size="lg" onClick={() => router.push("/dashboard")}>
          Go to Home
        </Button>
      </div>
    </main>
    </ProtectedRoute>
  );
}
