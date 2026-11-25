import { actorDisplayName } from "@/lib/deals/dealGroups";

export default function DealOwnerAvatar({
  email
}: {
  email: string | null | undefined;
}) {
  if (!email) {
    return (
      <span className="text-xs text-muted" data-testid="deal-owner-unassigned">
        Unassigned
      </span>
    );
  }
  const name = actorDisplayName(email);
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs text-fg"
      title={email}
      data-testid="deal-owner"
    >
      <span
        aria-hidden
        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-surface-2 text-[10px] font-medium text-fg"
      >
        {initials}
      </span>
      <span className="max-w-[7rem] truncate">{name}</span>
    </span>
  );
}
