import Card from "@/components/ui/Card";
import ProgressRing from "@/components/ui/ProgressRing";
import { formatInrCompact } from "@/lib/format";
import type { HomeGoal } from "@/lib/home/assemble";
import { cn } from "@/components/ui/cn";

export default function HomeGoalCard({ goal }: { goal: HomeGoal }) {
  const pct = goal.pace.pct * 100;
  const center = `${pct.toFixed(1).replace(/\.0$/, "")}%`;
  const dealWord = goal.won === 1 ? "deal" : "deals";
  const unvaluedWord = goal.unvalued === 1 ? "deal has" : "deals have";
  const unvaluedPronoun = goal.unvalued === 1 ? "it" : "them";

  return (
    <div data-testid="home-goal" className="h-full">
    <Card className="h-full">
      <div className="flex items-start gap-5">
        <ProgressRing
          value={goal.revenue}
          target={goal.target}
          center={center}
          size={96}
        />
        <div className="min-w-0 flex-1">
          <div className="section-label text-muted">{goal.monthLabel}</div>
          <div className="mt-1 whitespace-nowrap text-kpi tabular-nums tracking-tight text-fg xl:text-display">
            {formatInrCompact(goal.revenue)}
            <span className="text-[1.25rem] font-semibold text-muted">
              {" "}
              / {formatInrCompact(goal.target)}
            </span>
          </div>
          <p className="mt-2 text-sm text-fg">{goal.pace.paceLine}</p>
          <p
            className={cn(
              "mt-1 text-xs font-medium",
              goal.pace.status === "ahead" ? "text-accent-text" : "text-warning"
            )}
          >
            {goal.pace.status === "ahead" ? "Ahead of pace" : "Behind pace"}
          </p>
          <p className="mt-2 text-xs text-muted">
            <a href={goal.wonHref} className="underline decoration-subtle hover:text-fg">
              {goal.won} {dealWord} won this month
            </a>
          </p>
        </div>
      </div>
      {goal.unvalued > 0 ? (
        <p className="mt-3 text-xs text-muted">
          <a
            href={goal.unvaluedHref}
            className="underline decoration-subtle hover:text-fg"
          >
            {goal.unvalued} won {unvaluedWord} no value — add {unvaluedPronoun} in
            Deals
          </a>
        </p>
      ) : null}
    </Card>
    </div>
  );
}
