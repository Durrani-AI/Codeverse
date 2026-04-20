/**
 * Codeverse logo icon — inline SVG of the </> code brackets.
 * No background or border — just the symbol.
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
      viewBox="100 140 312 232"
      width={size}
      height={size}
      className={className}
      aria-label="Codeverse logo"
    >
      <defs>
        <linearGradient id="cv-bracketGrad" x1="0" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#b388ff" />
          <stop offset="50%" stopColor="#9c5cf7" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
        <linearGradient id="cv-slashGrad" x1="0.5" y1="0" x2="0.5" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
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
