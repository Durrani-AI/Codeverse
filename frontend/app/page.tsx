import Link from "next/link";

export default function Home() {
  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Subtle radial glow behind hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                   w-[600px] h-[600px] rounded-full
                   bg-brand-500/[0.04] blur-[120px]"
      />

      <div className="relative z-10 max-w-2xl text-center animate-fade-in">
        {/* Eyebrow */}
        <span className="inline-block mb-6 text-xs tracking-[0.25em] uppercase text-foreground-muted">
          AI-Powered Practice
        </span>

        {/* Hero heading */}
        <h1 className="text-5xl sm:text-6xl font-bold leading-[1.1] tracking-tight text-foreground">
          Master Your Next{" "}
          <span className="text-accent">Technical Interview</span>
        </h1>

        {/* Sub-copy */}
        <p className="mt-6 text-lg text-foreground-muted leading-relaxed max-w-lg mx-auto text-balance">
          Realistic mock interviews powered by AI.&nbsp;Get instant feedback,
          track your progress, and build&nbsp;confidence.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
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

        {/* Trust line */}
        <p className="mt-14 text-xs text-foreground-muted/50 tracking-wide">
          Coding · Behavioral · System Design
        </p>
      </div>
    </main>
  );
}
