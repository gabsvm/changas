export function PrivacyNotice({
  title = "Tus datos privados no se publican",
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-moss/15 bg-moss/7 text-ink rounded-2xl border p-4" role="note">
      <div className="flex gap-3">
        <span
          className="bg-moss/10 text-moss grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
            <rect
              x="5"
              y="10"
              width="14"
              height="10"
              rx="2.5"
              stroke="currentColor"
              strokeWidth="1.8"
            />
            <path
              d="M8.5 10V7.5a3.5 3.5 0 0 1 7 0V10"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </span>
        <div>
          <p className="text-sm font-bold">{title}</p>
          <div className="text-ink/60 mt-1 text-xs leading-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
