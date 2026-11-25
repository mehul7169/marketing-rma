import HomeFilters from "@/components/home/HomeFilters";
import HomeFunnelCard from "@/components/home/HomeFunnelCard";
import HomeGoalCard from "@/components/home/HomeGoalCard";
import HomeKpiStrip from "@/components/home/HomeKpiStrip";
import HomeLeaderboard from "@/components/home/HomeLeaderboard";
import HomeTrendCard from "@/components/home/HomeTrendCard";
import { FadeIn } from "@/components/ui/Enter";
import { getCurrentOrgId } from "@/lib/auth/getCurrentOrgId";
import { loadHomeDashboard } from "@/lib/db/homeDashboard";
import { parseHomeRange, parseHomeTraffic } from "@/lib/home/range";
import { todayISTDateString } from "@/lib/timezone";

export default async function HomePage({
  searchParams
}: {
  searchParams: { range?: string; traffic?: string };
}) {
  const todayISO = todayISTDateString();
  const range = parseHomeRange(searchParams.range);
  const traffic = parseHomeTraffic(searchParams.traffic);
  const orgId = await getCurrentOrgId();
  const dash = await loadHomeDashboard({
    orgId,
    range,
    traffic,
    todayISO
  });

  return (
    <div className="space-y-6" data-testid="home-page">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="page-title">Home</h1>
        <HomeFilters range={dash.range} traffic={dash.traffic} />
      </div>

      <div className="flex flex-col gap-4 xl:flex-row">
        {dash.goal ? (
          <FadeIn
            id={`home-goal-${dash.range}-${dash.traffic}`}
            className="min-w-0 xl:w-[40%]"
          >
            <HomeGoalCard goal={dash.goal} />
          </FadeIn>
        ) : null}
        <FadeIn
          id={`home-kpis-${dash.range}-${dash.traffic}`}
          className={dash.goal ? "min-w-0 flex-1 xl:w-[60%]" : "min-w-0 w-full"}
        >
          <HomeKpiStrip kpis={dash.kpis} ads={dash.ads} />
        </FadeIn>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,55%)_minmax(0,45%)]">
        <HomeFunnelCard steps={dash.funnel} qualified={dash.qualified} />
        <div className="space-y-4">
          <HomeTrendCard trends={dash.trends} bucket={dash.trendBucket} />
          <HomeLeaderboard setters={dash.setters} closers={dash.closers} />
        </div>
      </div>
    </div>
  );
}
