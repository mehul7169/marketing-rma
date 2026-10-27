"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { withLeadParam } from "@/lib/leads/leadHref";

export function useLeadDrawerParam() {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const leadId = search.get("lead");

  const open = useCallback(
    (id: string) => {
      router.push(withLeadParam(pathname, search.toString(), id), {
        scroll: false
      });
    },
    [pathname, router, search]
  );

  const close = useCallback(() => {
    router.push(withLeadParam(pathname, search.toString(), null), {
      scroll: false
    });
  }, [pathname, router, search]);

  return { leadId, open, close };
}
