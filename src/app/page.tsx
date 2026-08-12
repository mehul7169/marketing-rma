export default function HomePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">
        Funnel Dashboard
      </h1>
      <p className="max-w-2xl text-sm text-slate-600">
        Phase 1: Meta Ads performance + website/video analytics. The code is
        structured so a leads table and a GHL webhook integration can be
        added later without refactoring the existing dashboard pages.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="/meta-ads"
          className="rounded border border-slate-200 p-5 hover:border-slate-300"
        >
          <div className="text-sm font-medium text-slate-900">
            Meta Ads
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Spend, leads, CTR, and trends
          </div>
        </a>
        <a
          href="/website"
          className="rounded border border-slate-200 p-5 hover:border-slate-300"
        >
          <div className="text-sm font-medium text-slate-900">
            Website & Video
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Landing visits and video engagement
          </div>
        </a>
      </div>
    </div>
  );
}

