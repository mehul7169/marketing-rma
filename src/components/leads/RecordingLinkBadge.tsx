"use client";

/** Small list-table indicator when a lead has a recording_url saved. */
export default function RecordingLinkBadge({ url }: { url: string | null | undefined }) {
  if (!url) return null;

  return (
    <span
      className="ml-1.5 inline-flex align-middle"
      title="Recording link saved"
    >
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-600"
        aria-hidden
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3 w-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <path d="M6.5 4.5v7l6-3.5-6-3.5Z" strokeLinejoin="round" />
          <circle cx="8" cy="8" r="6.25" />
        </svg>
      </span>
      <span className="sr-only">Recording link saved</span>
    </span>
  );
}
