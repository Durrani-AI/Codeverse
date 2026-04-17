/*    Dashboard / Home - authenticated landing page
   
   - Welcome message with user's name
   - "Start New Interview" panel with type + difficulty selectors
   - Quick stats row (total sessions, avg score, trend)
   - Recent interview sessions in a responsive grid (InterviewCard)
   - Full loading skeleton & error states */

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AnalyticsOverview,
  DifficultyLevel,
  InterviewSession,
} from "@/types";
import {
  getAnalyticsOverview,
  listSessions,
  startInterview,
} from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { cn, scoreColor } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { InterviewCard } from "@/components/interview-card";
import ProtectedRoute from "@/components/protected-route";
import { useToast } from "@/components/toast";

// Types

interface DashboardState {
  analytics: AnalyticsOverview | null;
  sessions: InterviewSession[];
  loading: boolean;
  error: string | null;
}

// Difficulty & language options

const DIFFICULTY_LEVELS: { value: DifficultyLevel; label: string; color: string }[] = [
  { value: "easy", label: "Easy", color: "text-success" },
  { value: "medium", label: "Medium", color: "text-warning" },
  { value: "hard", label: "Hard", color: "text-danger" },
];

const PROGRAMMING_LANGUAGES = [
  "Python",
  "Java",
  "C#",
  "JavaScript",
  "TypeScript",
  "C++",
  "Go",
] as const;

// Skeleton loader

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-8">
      {/* Welcome skeleton */}
      <div className="space-y-2">
        <div className="h-8 w-64 rounded bg-surface-card" />
        <div className="h-4 w-48 rounded bg-surface-card" />
      </div>

      {/* Stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="stat-card">
            <div className="h-8 w-16 mx-auto rounded bg-surface-border" />
            <div className="h-3 w-20 mx-auto mt-2 rounded bg-surface-border" />
          </div>
        ))}
      </div>

      {/* Start panel skeleton */}
      <div className="card h-48" />

      {/* Cards grid skeleton */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="card h-44" />
        ))}
      </div>
    </div>
  );
}

// Page component

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();

  const [state, setState] = useState<DashboardState>({
    analytics: null,
    sessions: [],
    loading: true,
    error: null,
  });

  // New interview form state
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyLevel>("medium");
  const [topic, setTopic] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("Python");
  const [starting, setStarting] = useState(false);

  // Fetch data on mount

  useEffect(() => {
    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));

      try {
        const [analyticsRes, sessionsRes] = await Promise.all([
          getAnalyticsOverview(),
          listSessions(),
        ]);

        setState({
          analytics: analyticsRes.ok ? analyticsRes.data : null,
          sessions: sessionsRes.ok ? sessionsRes.data : [],
          loading: false,
          error: null,
        });
      } catch {
        setState((s) => ({ ...s, loading: false, error: "Something went wrong while loading the dashboard." }));
      }
    }

    load();
  }, []);

  // Start a new interview

  const handleStart = useCallback(async () => {
    if (!selectedLanguage.trim()) {
      return;
    }

    setStarting(true);
    try {
      const res = await startInterview({
        interview_type: "coding",
        difficulty_level: selectedDifficulty,
        topic:
          topic.trim() || `${selectedLanguage} interview practice`,
        programming_language: selectedLanguage,
      });

      if (res.ok) {
        router.push(`/interview/${res.data.session_id}`);
      } else {
        const errData = res.data as unknown as { detail?: string };
        const msg = errData?.detail ?? "Failed to start interview. Please try again.";
        toast("error", msg);
      }
    } catch {
      toast("error", "Something went wrong. Please try again.");
    } finally {
      setStarting(false);
    }
  }, [selectedDifficulty, topic, selectedLanguage, router, toast]);

  // Navigation helpers

  const handleResume = useCallback(
    (id: string) => router.push(`/interview/${id}`),
    [router],
  );

  const handleViewDetails = useCallback(
    (id: string) => router.push(`/interview/${id}/results`),
    [router],
  );

  // Render

  if (state.loading) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <DashboardSkeleton />
        </main>
      </ProtectedRoute>
    );
  }

  if (state.error) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="glass flex flex-col items-center gap-4 py-16 text-center">
            <div className="text-3xl text-danger">!</div>
            <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
            <p className="text-foreground-muted text-sm max-w-md">{state.error}</p>
            <Button variant="outline" onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const { analytics, sessions } = state;

  return (
    <ProtectedRoute>
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 space-y-10 animate-fade-in">
      {/*  Welcome header */}
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Welcome back, <span className="text-accent">{user?.username ?? ""}</span>
        </h1>
        <p className="mt-2 text-foreground-muted text-sm">
          Ready to sharpen your coding skills? Pick a language and start practising.
        </p>
      </header>

      {/*  Quick stats */}
      {analytics && (
        <section aria-label="Quick stats" className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="stat-card">
            <p className="stat-number">{analytics.sessions_count}</p>
            <p className="stat-label">Total Interviews</p>
          </div>
          <div className="stat-card">
            <p className={cn("stat-number", analytics.average_score > 0 ? scoreColor(analytics.average_score) : "")}>
              {analytics.average_score > 0 ? analytics.average_score.toFixed(1) : "-"}
            </p>
            <p className="stat-label">Average Score</p>
          </div>
          <div className="stat-card">
            <p className="stat-number">{analytics.completed_sessions}</p>
            <p className="stat-label">Completed</p>
          </div>
          <div className="stat-card">
            <p className="stat-number">
              <Badge
                variant={
                  analytics.improvement_trend === "improving"
                    ? "success"
                    : analytics.improvement_trend === "declining"
                      ? "danger"
                      : "default"
                }
              >
                {analytics.improvement_trend === "improving"
                  ? "↑ Improving"
                  : analytics.improvement_trend === "declining"
                    ? "↓ Declining"
                    : analytics.improvement_trend === "stable"
                      ? "-> Stable"
                      : "-"}
              </Badge>
            </p>
            <p className="stat-label">Trend</p>
          </div>
        </section>
      )}

      {/*  Start New Interview */}
      <section aria-label="Start new interview" className="glass p-6 space-y-6">
        <h2 className="text-lg font-semibold text-foreground tracking-tight">Start New Coding Practice</h2>

        <div className="grid sm:grid-cols-3 gap-6">
          {/* Programming language */}
          <div className="space-y-2">
            <label
              htmlFor="language-select"
              className="text-xs font-medium uppercase tracking-wider text-foreground-muted"
            >
              Programming Language
            </label>
            <div className="grid grid-cols-1 gap-2">
              {PROGRAMMING_LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => setSelectedLanguage(lang)}
                  className={cn(
                    "flex items-center gap-3 rounded-sm border px-4 py-3 text-left text-sm transition-all duration-200",
                    selectedLanguage === lang
                      ? "border-brand-500/50 bg-brand-500/[0.08] text-foreground shadow-[0_0_12px_rgba(139,92,246,0.05)]"
                      : "border-surface-border bg-surface-card/50 text-foreground-muted hover:border-brand-500/30 hover:text-foreground",
                  )}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-foreground-muted">Difficulty</label>
            <div className="grid grid-cols-1 gap-2">
              {DIFFICULTY_LEVELS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setSelectedDifficulty(d.value)}
                  className={cn(
                    "rounded-sm border px-4 py-3 text-left text-sm transition-all duration-200",
                    selectedDifficulty === d.value
                      ? "border-brand-500/50 bg-brand-500/[0.08] text-foreground shadow-[0_0_12px_rgba(139,92,246,0.05)]"
                      : "border-surface-border bg-surface-card/50 text-foreground-muted hover:border-brand-500/30",
                  )}
                >
                  <span className={d.color}>{d.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Topic + start */}
          <div className="space-y-4 flex flex-col">
            <div className="space-y-2">
              <label htmlFor="topic-input" className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
                Topic (optional)
              </label>
              <input
                id="topic-input"
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="e.g. Arrays, Linked Lists, Recursion"
                className="input"
              />
              <p className="text-xs text-foreground-muted">
                Questions will be generated for {selectedLanguage} at {selectedDifficulty} level.
              </p>
            </div>

            <Button
              variant="primary"
              size="lg"
              fullWidth
              isLoading={starting}
              loadingText="Starting..."
              onClick={handleStart}
              className="mt-auto"
            >
              Start Practice {"->"}
            </Button>
          </div>
        </div>
      </section>

      {/*  Recent Interview Sessions */}
      <section aria-label="Recent interviews" className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground tracking-tight">Recent Interviews</h2>
          {sessions.length > 6 && (
            <Button variant="ghost" size="sm" onClick={() => router.push("/sessions")}>
              View all {"->"}
            </Button>
          )}
        </div>

        {sessions.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 py-14 text-center">
            <p className="text-foreground-muted text-sm">
              No interviews yet. Start your first one above!
            </p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sessions.slice(0, 6).map((session) => (
              <InterviewCard
                key={session.id}
                session={session}
                onResume={handleResume}
                onViewDetails={handleViewDetails}
              />
            ))}
          </div>
        )}
      </section>

    </main>
    </ProtectedRoute>
  );
}

