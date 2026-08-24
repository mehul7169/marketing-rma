"use client";

import { useRouter } from "next/navigation";

export default function LeadRow({
  href,
  children
}: {
  href: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      className="group cursor-pointer hover:bg-slate-50/60"
      onClick={() => router.push(href)}
    >
      {children}
    </tr>
  );
}
