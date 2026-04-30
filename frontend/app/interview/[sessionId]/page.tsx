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
  RunCodeResponse,
} from "@/types";
import { getSession, runCode, submitAnswer } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { CodeEditor, type SupportedLanguage } from "@/components/code-editor";
import ProtectedRoute from "@/components/protected-route";
import BackButton from "@/components/back-button";

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

interface RunState {
  running: boolean;
  hasRun: boolean;
  result: RunCodeResponse | null;
  error: string | null;
}

function mapProgrammingLanguageToEditorLanguage(
  language: string | null | undefined,
): SupportedLanguage {
  const v = (language ?? "").trim().toLowerCase();

  if (v === "python") return "python";
  if (v === "javascript" || v === "js") return "javascript";
  if (v === "typescript" || v === "ts") return "typescript";
  if (v === "java") return "java";
  if (v === "c#" || v === "csharp") return "csharp";
  if (v === "c++" || v === "cpp") return "cpp";
  if (v === "go" || v === "golang") return "go";

  return "python";
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

  const [runState, setRunState] = useState<RunState>({
    running: false,
    hasRun: false,
    result: null,
    error: null,
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
        totalQuestions: session.total_questions || session.questions_count || questions.length,
        loading: false,
        error: null,
      });

      if (session.interview_type === "coding" && session.programming_language) {
        setLanguage(mapProgrammingLanguageToEditorLanguage(session.programming_language));
      }

      if (lastQ?.problem?.starter_code) {
        setCodeText(lastQ.problem.starter_code);
      }

      setRunState({
        running: false,
        hasRun: false,
        result: null,
        error: null,
      });
    }

    load();
  }, [sessionId, router]);

  // Submit answer
  const handleSubmit = useCallback(async () => {
    const question = state.currentQuestion;
    if (!question) return;

    const requiresRun =
      state.session?.interview_type === "coding" &&
      ["python", "py", ""].includes(
        String(
          question.problem?.programming_language ||
            state.session?.programming_language ||
            "python",
        ).toLowerCase(),
      ) &&
      Boolean(question.problem?.public_test_cases?.length);

    if (requiresRun && !runState.hasRun) {
      setState((s) => ({
        ...s,
        error: "Run your code at least once before submitting.",
      }));
      return;
    }

    setSubmission({ submitting: true, isComplete: false });
    setState((s) => ({ ...s, error: null }));

    const res = await submitAnswer(sessionId, {
      question_id: question.id,
      response_text: answerText || "See code below",
      response_code: codeText || undefined,
    });

    if (!res.ok) {
      // If session was already completed (e.g. previous attempt succeeded
      // but response was lost), redirect to results instead of showing error.
      if (res.status === 400) {
        const session = await getSession(sessionId);
        if (session.ok && session.data.status === "completed") {
          router.push(`/interview/${sessionId}/results`);
          return;
        }
      }
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
      setCodeText(data.next_question.problem?.starter_code ?? "");
      setSubmission({ submitting: false, isComplete: false });
      setRunState({
        running: false,
        hasRun: false,
        result: null,
        error: null,
      });
    }
  }, [state.currentQuestion, state.session?.interview_type, state.session?.programming_language, sessionId, answerText, codeText, router, runState.hasRun]);

  // Run code against public test cases
  const handleRunCode = useCallback(async () => {
    const question = state.currentQuestion;
    if (!question) return;

    if (!codeText.trim()) {
      setRunState((prev) => ({
        ...prev,
        error: "Write code before running tests.",
      }));
      return;
    }

    setRunState({
      running: true,
      hasRun: false,
      result: null,
      error: null,
    });

    const res = await runCode(sessionId, {
      question_id: question.id,
      response_code: codeText,
    });

    if (!res.ok) {
      const msg = (res.data as unknown as { detail?: string }).detail ??
        "Failed to run tests. Please try again.";

      setRunState({
        running: false,
        hasRun: false,
        result: null,
        error: msg,
      });
      return;
    }

    setRunState({
      running: false,
      hasRun: true,
      result: res.data,
      error: null,
    });
  }, [state.currentQuestion, sessionId, codeText]);

  // Skip question (submit empty)
  const handleSkip = useCallback(async () => {
    const question = state.currentQuestion;
    if (!question) return;

    setSubmission({ submitting: true, isComplete: false });
    setState((s) => ({ ...s, error: null }));

    const res = await submitAnswer(sessionId, {
      question_id: question.id,
      response_text: "(skipped)",
    });

    if (!res.ok) {
      if (res.status === 400) {
        const session = await getSession(sessionId);
        if (session.ok && session.data.status === "completed") {
          router.push(`/interview/${sessionId}/results`);
          return;
        }
      }
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
      setCodeText(data.next_question.problem?.starter_code ?? "");
      setSubmission({ submitting: false, isComplete: false });
      setRunState({
        running: false,
        hasRun: false,
        result: null,
        error: null,
      });
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
  const runnerLanguage = (
    currentQuestion?.problem?.programming_language ||
    session?.programming_language ||
    "python"
  ).toLowerCase();
  const runnerSupported = runnerLanguage === "python" || runnerLanguage === "py";
  const requiresRunBeforeSubmit =
    session?.interview_type === "coding" &&
    runnerSupported &&
    Boolean(currentQuestion?.problem?.public_test_cases?.length);

  return (
    <ProtectedRoute>
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-6 animate-fade-in">
      <BackButton href="/dashboard" label="Back to Dashboard" />
      {/* Top bar */}
      <header className="glass flex flex-wrap items-center justify-between gap-4 py-3 px-5">
        {/* Left - session info */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-foreground">
            Coding Practice
          </h1>
          {session && (
            <Badge variant="warning">
              {session.difficulty_level.charAt(0).toUpperCase() + session.difficulty_level.slice(1)}
            </Badge>
          )}
          {session?.programming_language && (
            <Badge variant="default">{session.programming_language}</Badge>
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
            {currentQuestion.problem?.source && (
              <Badge variant="success">{currentQuestion.problem.source}</Badge>
            )}
          </div>

          {currentQuestion.problem ? (
            <div className="space-y-5">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-foreground">
                  {currentQuestion.problem.title}
                </h2>
                <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
                  {currentQuestion.problem.statement}
                </p>
              </div>

              {currentQuestion.problem.function_signature && (
                <div className="rounded-md border border-surface-border bg-surface-card/60 px-3 py-2">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted">Function Signature</p>
                  <p className="mt-1 font-mono text-sm text-foreground whitespace-pre-wrap">
                    {currentQuestion.problem.function_signature}
                  </p>
                </div>
              )}

              {currentQuestion.problem.constraints.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted">Constraints</p>
                  <ul className="list-disc space-y-1 pl-5 text-sm text-foreground-muted">
                    {currentQuestion.problem.constraints.map((item, idx) => (
                      <li key={`${item}-${idx}`}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {currentQuestion.problem.examples.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted">Examples</p>
                  <div className="space-y-3">
                    {currentQuestion.problem.examples.map((example, idx) => (
                      <div
                        key={`${example.input}-${idx}`}
                        className="rounded-md border border-surface-border bg-surface-card/50 p-3"
                      >
                        <p className="font-mono text-xs text-foreground">Input: {example.input}</p>
                        <p className="mt-1 font-mono text-xs text-foreground">Output: {example.output}</p>
                        {example.explanation && (
                          <p className="mt-1 text-xs text-foreground-muted">Explanation: {example.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {currentQuestion.problem.public_test_cases.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs uppercase tracking-wider text-foreground-muted">Public Test Cases</p>
                  <div className="space-y-2">
                    {currentQuestion.problem.public_test_cases.map((test, idx) => (
                      <div
                        key={`${test.input}-${idx}`}
                        className="rounded-md border border-surface-border bg-surface-card/50 p-3"
                      >
                        <p className="font-mono text-xs text-foreground">Input: {test.input}</p>
                        <p className="mt-1 font-mono text-xs text-foreground">Expected: {test.expected_output}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-foreground text-base leading-relaxed whitespace-pre-wrap">
              {currentQuestion.question_text}
            </p>
          )}
        </section>
      )}

      {/* Answer area */}
      {currentQuestion && (
        <section className="space-y-4">
          {/* Code editor */}
          <CodeEditor
            value={codeText}
            onChange={setCodeText}
            language={language}
            onLanguageChange={setLanguage}
            lockLanguage={Boolean(state.session?.programming_language)}
            disabled={submission.submitting}
            placeholder="// Write your solution here..."
            draftKey={`interview-${sessionId}-code`}
            minHeight="300px"
          />

          {/* Explanation text area */}
          <div className="space-y-2">
            <label htmlFor="answer-text" className="text-xs font-medium uppercase tracking-wider text-foreground-muted">
              Explanation / Approach (optional)
            </label>
            <textarea
              id="answer-text"
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Explain your approach..."
              rows={3}
              disabled={submission.submitting}
              className={cn(
                "input font-sans resize-y",
                submission.submitting && "opacity-50 cursor-not-allowed",
              )}
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            {runnerSupported && currentQuestion?.problem?.public_test_cases?.length ? (
              <Button
                variant="outline"
                size="lg"
                isLoading={runState.running}
                loadingText="Running..."
                onClick={handleRunCode}
                disabled={submission.submitting}
              >
                Run Code
              </Button>
            ) : null}

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

          {requiresRunBeforeSubmit && !runState.hasRun && (
            <p className="text-xs text-warning">
              Run your solution once before submit so you can catch obvious bugs early.
            </p>
          )}

          {session?.interview_type === "coding" && !runnerSupported && (
            <p className="text-xs text-foreground-muted">
              Run Code is currently available for Python questions only.
            </p>
          )}

          {runState.error && (
            <div className="rounded-md border border-danger/30 bg-danger-light px-3 py-2 text-sm text-danger">
              {runState.error}
            </div>
          )}

          {runState.result && (
            <div className="rounded-lg border border-surface-border bg-surface-card/60 p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Run Results</h3>
                <p className={cn(
                  "text-xs font-medium",
                  runState.result.all_passed ? "text-success" : "text-warning",
                )}>
                  Passed {runState.result.passed_tests}/{runState.result.total_tests}
                </p>
              </div>

              <div className="space-y-2">
                {runState.result.test_results.map((test, idx) => (
                  <div
                    key={`${test.input}-${idx}`}
                    className="rounded-md border border-surface-border bg-surface/60 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-foreground-muted">Test {idx + 1}</p>
                      <p className={cn("text-xs font-semibold", test.passed ? "text-success" : "text-danger")}>
                        {test.passed ? "PASS" : "FAIL"}
                      </p>
                    </div>
                    <p className="mt-1 font-mono text-xs text-foreground">Input: {test.input}</p>
                    <p className="mt-1 font-mono text-xs text-foreground">Expected: {test.expected_output}</p>
                    {test.actual_output && (
                      <p className="mt-1 font-mono text-xs text-foreground">Actual: {test.actual_output}</p>
                    )}
                    {typeof test.runtime_ms === "number" && (
                      <p className="mt-1 text-[11px] text-foreground-muted">Runtime: {test.runtime_ms.toFixed(2)} ms</p>
                    )}
                    {test.error && (
                      <p className="mt-1 text-[11px] text-danger">{test.error}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}



      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-foreground-muted">
          <span>Progress</span>
          <span>{Math.round(((questionIndex - 1) / Math.max(totalQuestions, 1)) * 100)}%</span>
        </div>
        <div className="h-1 w-full rounded-full bg-surface-border/50 overflow-hidden">
          <div
            className="h-1 rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${((questionIndex - 1) / Math.max(totalQuestions, 1)) * 100}%` }}
          />
        </div>
      </div>
    </main>
    </ProtectedRoute>
  );
}
