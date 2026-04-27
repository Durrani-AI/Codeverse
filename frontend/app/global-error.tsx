"use client";

// App Router global error boundary — catches unhandled errors in the root layout
// and reports them to Sentry before rendering a fallback UI.
// https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-global-errors

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0a0a0f] text-white flex items-center justify-center px-6">
        <div className="text-center space-y-6 max-w-md">
          <div className="w-16 h-16 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">
              Something went wrong
            </h1>
            <p className="text-sm text-gray-400">
              An unexpected error occurred. The team has been notified
              automatically.
            </p>
            {error.digest && (
              <p className="text-xs text-gray-600 font-mono">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 transition-colors text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
