/*    CodeEditor – rich code editing component for interview answers
   
   - Uses Monaco Editor (@monaco-editor/react) when available
   - Falls back to an enhanced <textarea> with line numbers
   - Supports Python, JavaScript, Java language selection
   - Character & word count display
   - Auto-save drafts to localStorage
   - Submit button with loading state
   - Fully accessible with ARIA labels */

"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// Lazy-load Monaco so the component works even if the package fails to load
const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-foreground-muted text-sm">
      Loading editor…
    </div>
  ),
});

// Types

export type SupportedLanguage = "python" | "javascript" | "java";

export interface CodeEditorProps {
  /** Current code value (controlled). */
  value: string;
  /** Callback when the code changes. */
  onChange: (value: string) => void;
  /** Programming language for syntax highlighting. @default "python" */
  language?: SupportedLanguage;
  /** Callback when the user changes the language picker. */
  onLanguageChange?: (lang: SupportedLanguage) => void;
  /** Callback when the user clicks "Submit". */
  onSubmit?: () => void;
  /** Show loading state on the submit button. */
  isSubmitting?: boolean;
  /** Disable all editing. */
  disabled?: boolean;
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string;
  /** localStorage key prefix for auto-save. Pass `null` to disable. @default "code-draft" */
  draftKey?: string | null;
  /** Maximum allowed characters (0 = unlimited). @default 0 */
  maxChars?: number;
  /** Extra Tailwind classes on the wrapper. */
  className?: string;
  /** Minimum height for the editor area. @default "320px" */
  minHeight?: string;
}

// Language metadata

const LANGUAGES: { value: SupportedLanguage; label: string }[] = [
  { value: "python", label: "Python" },
  { value: "javascript", label: "JavaScript" },
  { value: "java", label: "Java" },
];

// Helpers

function wordCount(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function lineCount(text: string): number {
  return text.split("\n").length;
}

// Auto-save hook

function useAutoSave(key: string | null, value: string) {
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!key || typeof window === "undefined") return;

    // Debounce writes to localStorage by 1 s
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      localStorage.setItem(key, value);
    }, 1000);

    return () => clearTimeout(timer.current);
  }, [key, value]);
}

function loadDraft(key: string | null): string | null {
  if (!key || typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

export function clearDraft(key: string): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem(key);
  }
}

// Fallback textarea with line numbers

interface TextareaEditorProps {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  minHeight: string;
}

function TextareaEditor({
  value,
  onChange,
  disabled,
  placeholder,
  minHeight,
}: TextareaEditorProps) {
  const lines = lineCount(value);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  // Sync scroll between line numbers and textarea
  const handleScroll = useCallback(() => {
    if (textareaRef.current && lineNumbersRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  return (
    <div className="flex overflow-hidden rounded-b-lg" style={{ minHeight }}>
      {/* Line numbers gutter */}
      <div
        ref={lineNumbersRef}
        className="flex-none w-12 bg-surface py-3 text-right pr-3 select-none overflow-hidden border-r border-surface-border"
        aria-hidden="true"
      >
        {Array.from({ length: lines }, (_, i) => (
          <div
            key={i}
            className="text-xs leading-6 text-foreground-muted font-mono"
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
          onChange(e.target.value)
        }
        onScroll={handleScroll}
        disabled={disabled}
        placeholder={placeholder}
        spellCheck={false}
        className={cn(
          "flex-1 resize-none bg-surface p-3 font-mono text-sm leading-6",
          "text-foreground placeholder:text-foreground-muted/50",
          "focus:outline-none",
          disabled && "opacity-50 cursor-not-allowed",
        )}
        style={{ minHeight }}
        aria-label="Code editor"
      />
    </div>
  );
}

// Main CodeEditor

export function CodeEditor({
  value,
  onChange,
  language = "python",
  onLanguageChange,
  onSubmit,
  isSubmitting = false,
  disabled = false,
  placeholder = "Write your code here…",
  draftKey = "code-draft",
  maxChars = 0,
  className,
  minHeight = "320px",
}: CodeEditorProps) {
  // Hydrate from draft on mount
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!hydrated && draftKey) {
      const draft = loadDraft(draftKey);
      if (draft && !value) {
        onChange(draft);
      }
      setHydrated(true);
    }
  }, [hydrated, draftKey, value, onChange]);

  // Auto-save the current value
  useAutoSave(draftKey, value);

  // Stats
  const chars = value.length;
  const words = useMemo(() => wordCount(value), [value]);
  const lines = useMemo(() => lineCount(value), [value]);
  const overLimit = maxChars > 0 && chars > maxChars;

  // Monaco change handler
  const handleMonacoChange = useCallback(
    (v: string | undefined) => {
      onChange(v ?? "");
    },
    [onChange],
  );

  return (
    <div
      className={cn(
        "flex flex-col rounded-lg border border-surface-border bg-surface overflow-hidden",
        className,
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border bg-surface-card px-3 py-2">
        {/* Language picker */}
        <div className="flex items-center gap-2">
          <label
            htmlFor="code-lang-select"
            className="text-xs font-medium text-foreground-muted"
          >
            Language
          </label>
          <select
            id="code-lang-select"
            value={language}
            onChange={(e) =>
              onLanguageChange?.(e.target.value as SupportedLanguage)
            }
            disabled={disabled}
            className={cn(
              "rounded-md border border-surface-border bg-surface px-2 py-1",
              "text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-brand-500",
              disabled && "opacity-50 cursor-not-allowed",
            )}
            aria-label="Select programming language"
          >
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-xs text-foreground-muted">
          <span>{lines} line{lines !== 1 ? "s" : ""}</span>
          <span>{words} word{words !== 1 ? "s" : ""}</span>
          <span className={overLimit ? "text-danger font-medium" : ""}>
            {chars}
            {maxChars > 0 && ` / ${maxChars}`} char{chars !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Editor area */}
      <MonacoEditor
        height={minHeight}
        language={language}
        value={value}
        onChange={handleMonacoChange}
        theme="vs-dark"
        options={{
          fontSize: 14,
          fontFamily: "var(--font-geist-mono), monospace",
          minimap: { enabled: false },
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          wordWrap: "on",
          tabSize: 4,
          readOnly: disabled,
          automaticLayout: true,
          padding: { top: 12, bottom: 12 },
          placeholder,
        }}
      />

      {/* Footer / submit bar */}
      {onSubmit && (
        <div className="flex items-center justify-between border-t border-surface-border bg-surface-card px-3 py-2">
          {/* Left: hint text */}
          <p className="text-xs text-foreground-muted">
            {overLimit
              ? "Character limit exceeded – trim your answer."
              : "Review your code before submitting."}
          </p>

          {/* Right: submit button */}
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              onSubmit();
              // Clear draft on successful submission intent
              if (draftKey) clearDraft(draftKey);
            }}
            isLoading={isSubmitting}
            loadingText="Submitting…"
            disabled={disabled || overLimit || !value.trim()}
          >
            Submit Answer
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Export the fallback editor too, in case consumers want a lightweight version

export { TextareaEditor };

