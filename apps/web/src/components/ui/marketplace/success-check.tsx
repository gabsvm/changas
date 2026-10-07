// Animated confirmation mark for "it worked" moments (proposal sent, etc.).
export function SuccessCheck({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`check-badge bg-success inline-grid h-7 w-7 shrink-0 place-items-center rounded-full text-white dark:text-[#171310] ${className}`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
        <path
          className="check-draw"
          d="m5.5 12.5 4.2 4.2 8.8-9.4"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
