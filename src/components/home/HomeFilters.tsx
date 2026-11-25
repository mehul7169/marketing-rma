"use client";

import { useRouter } from "next/navigation";
import Segmented from "@/components/ui/Segmented";
import {
  HOME_RANGE_OPTIONS,
  HOME_TRAFFIC_OPTIONS,
  homeHref,
  type HomeRangeId,
  type HomeTrafficId
} from "@/lib/home/range";

export default function HomeFilters({
  range,
  traffic
}: {
  range: HomeRangeId;
  traffic: HomeTrafficId;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div data-testid="home-range">
        <Segmented
          ariaLabel="Date range"
          options={HOME_RANGE_OPTIONS}
          value={range}
          onChange={(next) => router.push(homeHref({ range: next, traffic }))}
        />
      </div>
      <div data-testid="home-traffic">
        <Segmented
          ariaLabel="Traffic"
          options={HOME_TRAFFIC_OPTIONS}
          value={traffic}
          onChange={(next) => router.push(homeHref({ range, traffic: next }))}
        />
      </div>
    </div>
  );
}
