import {
  currentUserCanSeeOpsBanners,
  getMetaAdsHealth,
  metaAdsHealthBannerText
} from "@/lib/cron/metaAdsHealth";

export default async function MetaAdsHealthBanner({ orgId }: { orgId: string }) {
  const canSee = await currentUserCanSeeOpsBanners(orgId);
  if (!canSee) return null;
  const health = await getMetaAdsHealth(orgId);
  const text = metaAdsHealthBannerText(health);
  if (!text) return null;

  return (
    <div
      data-testid="meta-ads-health-banner"
      className="rounded border border-danger-soft bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {text}
    </div>
  );
}
