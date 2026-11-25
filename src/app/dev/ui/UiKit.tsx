"use client";

import { useState } from "react";
import Badge, { Pill } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChartCard from "@/components/ui/ChartCard";
import EmptyState from "@/components/ui/EmptyState";
import FunnelBar from "@/components/ui/FunnelBar";
import Input from "@/components/ui/Input";
import ProgressRing from "@/components/ui/ProgressRing";
import Segmented from "@/components/ui/Segmented";
import Select from "@/components/ui/Select";
import { SkeletonBlock } from "@/components/ui/Skeleton";
import Stat from "@/components/ui/Stat";
import StatStrip from "@/components/ui/StatStrip";
import Tabs from "@/components/ui/Tabs";
import SingleMetricLineChart from "@/components/charts/SingleMetricLineChart";
import { formatInteger } from "@/lib/format";

const RANGE = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "month", label: "Month" },
  { value: "all", label: "All" }
] as const;

const STAGES = [
  "new",
  "contacted",
  "qualified",
  "call_booked",
  "showed_up",
  "dead",
  "follow_up_call_booked",
  "awaiting_lead_response",
  "contract_shared",
  "awaiting_payment"
];

const CHART = [
  { date: "2026-11-01", n: 12 },
  { date: "2026-11-08", n: 18 },
  { date: "2026-11-15", n: 9 },
  { date: "2026-11-20", n: 22 }
];

function Kit() {
  const [range, setRange] = useState<(typeof RANGE)[number]["value"]>("7d");
  const [tab, setTab] = useState("open");

  return (
    <div className="space-y-8 p-6">
      <div>
        <p className="section-label">Type</p>
        <h1 className="mt-1 text-display text-fg">Display 44</h1>
        <p className="text-kpi text-fg">KPI 30</p>
        <p className="text-title text-fg">Title 20</p>
        <p className="text-body text-fg">Body 14 — The quick brown fox.</p>
        <p className="section-label mt-2">Label 11 uppercase</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button>Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="danger">Danger</Button>
      </div>

      <div className="grid max-w-md gap-3">
        <Input placeholder="Search leads" />
        <Select defaultValue="open">
          <option value="open">Open</option>
          <option value="won">Won</option>
        </Select>
      </div>

      <Segmented
        ariaLabel="Date range"
        options={[...RANGE]}
        value={range}
        onChange={setRange}
      />

      <Tabs
        ariaLabel="Deal tabs"
        activeId={tab}
        onSelect={setTab}
        items={[
          { id: "open", label: "Open", count: 34 },
          { id: "won", label: "Won", count: 13 },
          { id: "lost", label: "Lost", count: 25 }
        ]}
      />

      <StatStrip title="Funnel">
        <Stat label="Leads" value={128} size="lg" delta={{ direction: "up", label: "12%" }} />
        <Stat label="Booked" value={42} sub="42% booking rate" />
        <Stat label="Showed" value={28} delta={{ direction: "down", label: "4%" }} />
      </StatStrip>

      <div className="flex flex-wrap gap-6">
        <ProgressRing value={42} target={100} label="Booked" />
        <div className="w-72">
          <FunnelBar
            paid={70}
            organic={30}
            valueLabel="100"
            conversionLabel="70% paid · 30% organic"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge tone="neutral">Neutral</Badge>
        <Badge tone="success">Success</Badge>
        <Badge tone="warning">Warning</Badge>
        <Badge tone="danger">Danger</Badge>
        <Badge tone="accent">Accent</Badge>
        {STAGES.map((s) => (
          <Pill key={s} stage={s}>
            {s.replaceAll("_", " ")}
          </Pill>
        ))}
      </div>

      <ChartCard
        title="Leads"
        toggle={
          <Segmented
            ariaLabel="Chart metric"
            options={[
              { value: "leads", label: "Leads" },
              { value: "spend", label: "Spend" }
            ]}
            value="leads"
            onChange={() => {}}
          />
        }
        legend={
          <span className="text-xs text-muted">
            <span className="mr-1 inline-block h-2 w-2 rounded-pill bg-accent" /> Paid
          </span>
        }
      >
        <SingleMetricLineChart
          data={CHART}
          dataKey="n"
          label="Leads"
          color="var(--accent)"
          tooltipFormatter={formatInteger}
        />
      </ChartCard>

      <EmptyState title="No deals yet" body="Showed-up leads land here." action={<Button size="sm">Create lead</Button>} />

      <Card title="Skeleton">
        <SkeletonBlock className="h-8 w-48" />
      </Card>
    </div>
  );
}

export default function UiKit() {
  return (
    <div className="min-h-dvh">
      <header className="border-b border-subtle bg-surface px-6 py-4">
        <p className="section-label">Dev</p>
        <h1 className="text-title text-fg">UI kit</h1>
      </header>
      <div className="grid lg:grid-cols-2">
        <div data-theme="light" className="bg-page text-fg">
          <p className="px-6 pt-4 text-label uppercase text-muted">Light</p>
          <Kit />
        </div>
        <div data-theme="dark" className="bg-page text-fg">
          <p className="px-6 pt-4 text-label uppercase text-muted">Dark</p>
          <Kit />
        </div>
      </div>
    </div>
  );
}
