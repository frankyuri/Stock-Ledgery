interface Props {
  className?: string;
}

export function LogoMark({ className = 'h-8 w-8' }: Props) {
  return (
    <div
      className={`relative inline-flex items-center justify-center rounded-lg bg-blue-600 text-white shadow-xs overflow-hidden ${className}`}
      aria-label="Stocktify Logo"
      role="img"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
      >
        {/* Trend background wave */}
        <path
          d="M3 17L8 12L12 16L21 7"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Small accent dot at peak */}
        <circle cx="21" cy="7" r="1.5" fill="currentColor" />
        {/* Candlestick / Bar accents */}
        <path
          d="M6 19V14"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path
          d="M10 19V17"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.4"
        />
        <path
          d="M15 19V13"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          opacity="0.4"
        />
      </svg>
    </div>
  );
}
