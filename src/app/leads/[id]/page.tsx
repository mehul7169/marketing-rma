import { redirect } from "next/navigation";

/** Old detail URLs (Slack, bookmarks) open the slide-over on /leads. */
export default function LeadDetailRedirect({
  params
}: {
  params: { id: string };
}) {
  redirect(`/leads?lead=${encodeURIComponent(params.id)}`);
}
