/** Single optical language for directional links throughout YALO.
 * Reuses the project's existing up-right vector; not a new icon family.
 */
export function ActionArrowIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      className={`yalo-action-arrow ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 18 18 6M8 6h10v10" />
    </svg>
  );
}
