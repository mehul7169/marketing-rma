/**
 * Small circular spinner for row-level / inline async actions.
 * Keep scoped to the element in flight — never use for full-page loads.
 */
export default function Spinner({
  size = "sm",
  className = "",
  label = "Loading"
}: {
  size?: "xs" | "sm" | "md";
  className?: string;
  /** Accessible label (visually hidden). */
  label?: string;
}) {
  const dim =
    size === "xs" ? "h-3 w-3 border" : size === "md" ? "h-5 w-5 border-2" : "h-3.5 w-3.5 border-2";

  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex shrink-0 items-center justify-center ${className}`}
    >
      <span
        className={`${dim} animate-spin rounded-full border-slate-300 border-t-sky-600`}
        aria-hidden
      />
      <span className="sr-only">{label}</span>
    </span>
  );
}
