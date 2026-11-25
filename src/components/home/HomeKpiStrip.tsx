import Badge from "@/components/ui/Badge";
import Stat from "@/components/ui/Stat";
import StatStrip from "@/components/ui/StatStrip";
import { formatInrCompact } from "@/lib/format";
import type { HomeAds, HomeKpiTile } from "@/lib/home/assemble";

function AdsAction({ ads }: { ads: HomeAds }) {
  if (ads.kind === "stale") {
    return (
      <a href="/meta-ads" data-testid="home-ad-stale">
        <Badge tone="warning">
          Ad data stale since {ads.since} — reconnect Meta
        </Badge>
      </a>
    );
  }
  const perBooked =
    ads.costPerBooked == null
      ? "—"
      : `${formatInrCompact(ads.costPerBooked)} / booked`;
  return (
    <div className="text-xs text-muted" data-testid="home-ad-spend">
      Spend {formatInrCompact(ads.spend)}
      <span className="mx-1.5 text-muted">·</span>
      {perBooked}
    </div>
  );
}

export default function HomeKpiStrip({
  kpis,
  ads
}: {
  kpis: HomeKpiTile[];
  ads: HomeAds | null;
}) {
  return (
    <StatStrip
      title="This period"
      actions={ads ? <AdsAction ads={ads} /> : undefined}
    >
      {kpis.map((kpi) => (
        <Stat
          key={kpi.key}
          label={kpi.label}
          value={kpi.value}
          format="integer"
          size="lg"
          sub={kpi.sub}
          delta={kpi.delta ?? undefined}
          valueTestId={`home-kpi-${kpi.key}`}
        />
      ))}
    </StatStrip>
  );
}
