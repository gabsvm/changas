export function ProgressBar({
  value,
  label,
}: {
  value: number;
  label: string;
}) {
  const safeValue = Math.min(100, Math.max(0, value));

  return (
    <div>
      <div
        className="bg-ink/10 h-2 overflow-hidden rounded-full"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(safeValue)}
      >
        <div
          className="bg-brand-orange h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
          style={{ width: `${safeValue}%` }}
        />
      </div>
    </div>
  );
}
