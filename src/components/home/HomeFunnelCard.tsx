import Card from "@/components/ui/Card";
import FunnelBar from "@/components/ui/FunnelBar";
import { formatInteger } from "@/lib/format";
import type { FunnelStep } from "@/lib/home/metrics";

export default function HomeFunnelCard({
  steps,
  qualified
}: {
  steps: FunnelStep[];
  qualified: { count: number; ofContacted: string };
}) {
  const leadsTotal = steps[0]?.total ?? 0;

  return (
    <Card title="Funnel">
      <div className="space-y-4" data-testid="home-funnel">
        {steps.map((step) => (
          <a
            key={step.kpi}
            href={step.href}
            data-testid={`funnel-row-${step.kpi}`}
            className="block rounded-control px-1 py-0.5 hover:bg-surface-2"
          >
            <FunnelBar
              label={step.label}
              paid={step.paid}
              organic={step.organic}
              maxScale={leadsTotal}
              valueLabel={formatInteger(step.total)}
              conversionLabel={step.conversion?.label}
            />
          </a>
        ))}
      </div>
      <p className="mt-4 text-xs text-muted" data-testid="home-qualified">
        {qualified.ofContacted}
      </p>
    </Card>
  );
}
