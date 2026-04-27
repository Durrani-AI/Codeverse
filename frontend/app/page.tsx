"use client";

import { useState } from "react";
import Link from "next/link";
import TypingAnimation from "@/components/typing-animation";

export default function Home() {
  const [dismissed, setDismissed] = useState(false);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Ambient glow layers */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-[700px] h-[700px] rounded-full
                   bg-brand-500/[0.03] blur-[140px]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/3
                   w-[300px] h-[300px] rounded-full
                   bg-brand-400/[0.02] blur-[100px]"
      />

      <div className="relative z-10 max-w-2xl text-center space-y-8">
        {/* Cold-start disclaimer */}
        {!dismissed && (
          <div className="animate-fade-in rounded-lg border border-amber-500/30 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-300/90 flex items-start gap-3 text-left">
            <svg xmlns="http://www.w3.org/2000/svg" className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span>
              <strong className="text-amber-300">Heads up —</strong> this app runs on free-tier hosting (Render + Vercel). The backend may take <strong className="text-amber-300">30–60 seconds</strong> to wake up after 15 minutes of inactivity. If something feels slow on first load, just wait a moment and try again.
            </span>
            <button
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
              className="ml-auto shrink-0 text-amber-400/60 hover:text-amber-300 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Brand mark */}
        <div className="animate-fade-in flex flex-col items-center">
          <h1 className="text-6xl sm:text-7xl md:text-8xl font-bold tracking-tighter">
            <span className="bg-gradient-to-r from-brand-300 via-brand-400 to-brand-500 bg-clip-text text-transparent">
              Code
            </span>
            <span className="text-foreground">verse</span>
          </h1>
          <div className="mt-2 h-px w-24 mx-auto bg-gradient-to-r from-transparent via-brand-500/50 to-transparent" />
        </div>

        {/* Typing animation */}
        <div className="animate-fade-in [animation-delay:300ms] opacity-0 [animation-fill-mode:forwards]">
          <TypingAnimation />
        </div>

        {/* CTAs */}
        <div className="animate-fade-in [animation-delay:500ms] opacity-0 [animation-fill-mode:forwards] flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/register" className="btn-primary px-8 py-3 text-base">
            Get Started
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>

          <Link href="/login" className="btn-outline px-8 py-3 text-base">
            Sign In
          </Link>
        </div>
      </div>
    </main>
  );
}
