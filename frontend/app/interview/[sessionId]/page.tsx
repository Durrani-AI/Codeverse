/*
  Interview Session - live interview page
  - Gets sessionId from URL params
  - Displays current question prominently
  - Shows CodeEditor for coding / textarea for behavioral & system_design
  - Live elapsed-time timer
  - Submit Answer & Skip Question buttons
  - Question counter (e.g. "Question 2 of 10")
  - Shows AI feedback inline after each submission
  - Navigates to results page when session completes
  - Full loading, error, and empty states
*/

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type {
  AnswerSubmitResponse,
  InterviewSession,
  Question,
} from "@/types";
import { getSession, submitAnswer } from "@/lib/api";
import { cn, formatInterviewType } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { CodeEditor, type SupportedLanguage } from "@/components/code-editor";
import ProtectedRoute from "@/components/protected-route";

// State types

interface SessionState {
  session: InterviewSession | null;
  currentQuestion: Question | null;
  questionIndex: number;
  totalQuestions: number;
  loading: boolean;
  error: string | null;
}

interface SubmissionState {
  submitting: boolean;
  isComplete: boolean;
}

// Elapsed-time hook

function useElapsedTime(startedAt: string | null, active: boolean): string {
  const [elapsed, setElapsed] = useState("00:00");
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!startedAt || !active) return;

    function tick() {
      const diff = Math.max(0, Date.now() - new Date(startedAt!).getTime());
      const totalSec = Math.floor(diff / 1000);
      const h = Math.floor(totalSec / 3600);
      const m = Math.floor((totalSec % 3600) / 60);
      const s = totalSec % 60;
      setElapsed(
        h > 0
          ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
          : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
      );
    }

    tick();
    intervalRef.current = setInterval(tick, 1000);
    return () => clearInterval(intervalRef.current);
  }, [startedAt, active]);

  return elapsed;
}

// Page component

export default function InterviewSessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params.sessionId;
  const router = useRouter();

  // Core state
  const [state, setState] = useState<SessionState>({
    session: null,
    currentQuestion: null,
    questionIndex: 0,
    totalQuestions: 0,
    loading: true,
    error: null,
  });

  const [submission, setSubmission] = useState<SubmissionState>({
    submitting: false,
    isComplete: false,
  });

  // Editor state
  const [answerText, setAnswerText] = useState("");
  const [codeText, setCodeText] = useState("");
  const [language, setLanguage] = useState<SupportedLanguage>("python");

  // Timer
  const elapsed = useElapsedTime(
    state.session?.started_at ?? null,
    state.session?.status === "in_progress",
  );

  // Derived
  const isCoding = state.session?.interview_type === "coding";

  // Fetch session on mount
  useEffect(() => {
    async function load() {
      setState((s) => ({ ...s, loading: true, error: null }));

      const res = await getSession(sessionId);

      if (!res.ok) {
        setState((s) => ({ ...s, loading: false, error: "Failed to load session." }));
        return;
      }

      const session = res.data;
      const questions = session.questions ?? [];
      // Last question is the one currently being answered
      const lastQ = questions[questions.length - 1] ?? null;

      if (session.status === "completed") {
        router.replace(`/interview/${sessionId}/results`);
        return;
      }

      setState({
        session,
        currentQuestion: lastQ,
        questionIndex: questions.length,
        totalQuestions: session.questions_count || questions.length,
        loading: false,
        error: null,
      });
    }

    load();
  }, [sessionId, router]);

  // Submit answer
  const handleSubmit = useCallback(async () => {
    const question = state.currentQuestion;
    if (!question) return;

    setSubmission({ submitting: true, isComplete: false });

    const res = await submitAnswer(sessionId, {
      question_id: question.id,
      response_text: isCoding ? answerText || "See code below" : answerText,
      response_code: isCoding ? codeText : undefined,
    });

    if (!res.ok) {
      setSubmission({ submitting: false, isComplete: false });
      setState((s) => ({ ...s, error: "Failed to submit answer. Please try again." }));
      return;
    }

    const data: AnswerSubmitResponse = res.data;

    // If complete, redirect to results immediately
    if (data.is_complete) {
      router.push(`/interview/${sessionId}/results`);
      return;
    }

    // Advance to the next question immediately
    if (data.next_question) {
      setState((s) => ({
        ...s,
        currentQuestion: data.next_question,
        questionIndex: s.questionIndex + 1,
        totalQuestions: data.questions_remaining
          ? s.questionIndex + 1 + data.questions_remaining
          : s.totalQuestions,
      }));
      setAnswerText("");
      setCodeText("");
      setSubmission({ submitting: false, isComplete: false });
    }
  }, [state.currentQuestion, sessionId, answerText, codeText, isCoding, router]);

  // Skip question (submit empty)
  const handleSkip = useCallback(async () => {
    const question = state.currentQuestion;
    if (!question) return;

    setSubmission({ submitting: true, isComplete: false });

    const res = await submitAnswer(sessionId, {
      question_id: question.id,
      response_text: "(skipped)",
    });

    if (!res.ok) {
      setSubmission({ submitting: false, isComplete: false });
      return;
    }

    const data: AnswerSubmitResponse = res.data;

    if (data.is_complete) {
      router.push(`/interview/${sessionId}/results`);
      return;
    }

    if (data.next_question) {
      setState((s) => ({
        ...s,
        currentQuestion: data.next_question,
        questionIndex: s.questionIndex + 1,
      }));
      setAnswerText("");
      setCodeText("");
      setSubmission({ submitting: false, isComplete: false });
    }
  }, [state.currentQuestion, sessionId, router]);

  // Loading state
  if (state.loading) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 flex flex-col items-center gap-4 pt-32">
          <Spinner size="lg" />
          <p className="text-foreground-muted text-sm">Loading interview session...</p>
        </main>
      </ProtectedRoute>
    );
  }

  // Error state
  if (state.error && !state.session) {
    return (
      <ProtectedRoute>
        <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="glass flex flex-col items-center gap-4 py-16 text-center">
            <div className="text-3xl text-danger">!</div>
            <h2 className="text-xl font-semibold text-foreground">Error</h2>
            <p className="text-foreground-muted text-sm max-w-md">{state.error}</p>
            <Button variant="outline" onClick={() => router.push("/dashboard")}>
              Back to Dashboard
            </Button>
          </div>
        </main>
      </ProtectedRoute>
    );
  }

  const { session, currentQuestion, questionIndex, totalQuestions } = state;

  return (
    <ProtectedRoute>
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-fade-in">
      {/* Top bar */}
      <header className="glass flex flex-wrap items-center justify-between gap-4 py-3 px-5">
        {/* Left - session info */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">
            {session ? formatInterviewType(session.interview_type) : "Interview"}
          </h1>
          {session && (
            <Badge variant="warning">
              {session.difficulty_level.charAt(0).toUpperCase() + session.difficulty_level.slice(1)}
            </Badge>
          )}
        </div>

        {/* Centre - question counter */}
        <p className="text-sm text-foreground-muted font-medium">
          Question <span className="text-foreground">{questionIndex}</span> of{" "}
          <span className="text-foreground">{totalQuestions}</span>
        </p>

        {/* Right - timer */}
        <div className="flex items-center gap-2 text-sm font-mono text-foreground-muted">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-foreground">{elapsed}</span>
        </div>
      </header>

      {/* Inline error */}
      {state.error && (
        <div className="rounded-lg border border-danger/30 bg-danger-light px-4 py-3 text-sm text-danger">
          {state.error}
        </div>
      )}

      {/* Question card */}
      {currentQuestion && (
        <section className="question-card space-y-2">
          <div className="flex items-center gap-2 text-xs text-foreground-muted">
            <Badge variant="default">{currentQuestion.question_type.replace("_", " ")}</Badge>
          </div>
          <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
            {currentQuestion.question_text}
          </p>
        </section>
      )}

      {/* Answer area */}
      {currentQuestion && (
        <section className="space-y-4">
          {/* Text answer (always shown) */}
          <div className="space-y-2">
            <label htmlFor="answer-text" className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              {isCoding ? "Explanation / Approach" : "Your Answer"}
            </label>
            <textarea
              id="answer-text"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder={isCoding ? "Explain your approach..." : "Type your answer here..."}
              rows={isCoding ? 3 : 8}
              disabled={submission.submitting}
              className={cn(
                "input font-sans resize-y",
                submission.submitting && "opacity-50 cursor-not-allowed",
              )}
            />
          </div>

          {/* Code editor (coding questions only) */}
          {isCoding && (
            <CodeEditor
              value={codeText}
              onChange={setCodeText}
              language={language}
              onLanguageChange={setLanguage}
              disabled={submission.submitting}
              placeholder="// Write your solution here..."
              draftKey={`interview-${sessionId}-code`}
              minHeight="300px"
            />
          )}

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              isLoading={submission.submitting}
              loadingText="Submitting..."
              onClick={handleSubmit}
              disabled={!answerText.trim() && !codeText.trim()}
            >
              Submit Answer
            </Button>

            <Button
              variant="ghost"
              size="lg"
              onClick={handleSkip}
              disabled={submission.submitting}
            >
              Skip Question {"->"}
            </Button>
          </div>
        </section>
      )}



      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-foreground-muted">
          <span>Progress</span>
          <span>{Math.round((questionIndex / Math.max(totalQuestions, 1)) * 100)}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-surface-border/50 overflow-hidden">
          <div
            className="h-1 rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${(questionIndex / Math.max(totalQuestions, 1)) * 100}%` }}
          />
        </div>
      </div>
    </main>
    </ProtectedRoute>
  );
}
