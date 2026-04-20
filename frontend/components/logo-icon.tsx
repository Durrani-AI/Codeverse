/**
 * Codeverse logo icon — inline SVG matching the primary brand icon.
 * Renders the </> code brackets on a dark rounded-rect background.
 */

interface LogoIconProps {
  /** Width & height in pixels. Defaults to 32. */
  size?: number;
  className?: string;
}

export default function LogoIcon({ size = 32, className }: LogoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      aria-label="Codeverse logo"
    >
      <defs>
        <linearGradient id="cv-bgGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1a1028" />
          <stop offset="100%" stopColor="#0f0a1a" />
        </linearGradient>
        <linearGradient id="cv-bracketGrad" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#b388ff" />
          <stop offset="50%" stopColor="#9c5cf7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="cv-slashGrad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="cv-borderGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity={0.6} />
          <stop offset="50%" stopColor="#9c5cf7" stopOpacity={0.3} />
          <stop offset="100%" stopColor="#7c3aed" stopOpacity={0.1} />
        </linearGradient>
      </defs>
      <rect x="16" y="16" width="480" height="480" rx="96" ry="96" fill="url(#cv-bgGrad)" />
      <rect
        x="16"
        y="16"
        width="480"
        height="480"
        rx="96"
        ry="96"
        fill="none"
        stroke="url(#cv-borderGrad)"
        strokeWidth="4"
      />
      <path
        d="M200 168 L120 256 L200 344"
        fill="none"
        stroke="url(#cv-bracketGrad)"
        strokeWidth="36"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line
        x1="280"
        y1="160"
        x2="232"
        y2="352"
        stroke="url(#cv-slashGrad)"
        strokeWidth="30"
        strokeLinecap="round"
      />
      <path
        d="M312 168 L392 256 L312 344"
        fill="none"
        stroke="url(#cv-bracketGrad)"
        strokeWidth="36"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
