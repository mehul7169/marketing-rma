"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import ActionPopover from "@/components/leads/ActionPopover";
import { useFilterPending } from "@/components/leads/FilterPending";
import { ToolbarGhostButton, ViewsIcon } from "@/components/leads/FilterToolbar";
import type { NamedLeadFilter } from "@/lib/leads/namedFilters";

export default function SavedFilterMenu({
  pageKey,
  items,
  canManageShared,
  currentQuery,
  saveRequestKey = 0,
  columnsSlot
}: {
  pageKey: "leads" | "leads-queue";
  items: NamedLeadFilter[];
  canManageShared: boolean;
  currentQuery: Record<string, string>;
  saveRequestKey?: number;
  columnsSlot?: ReactNode;
}) {
  const router = useRouter();
  const { start } = useFilterPending();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [list, setList] = useState(items);
  const prevSave = useRef(saveRequestKey);
  const path = pageKey === "leads-queue" ? "/leads/queue" : "/leads";

  useEffect(() => setList(items), [items]);

  useEffect(() => {
    if (saveRequestKey !== prevSave.current) {
      prevSave.current = saveRequestKey;
      if (saveRequestKey > 0) {
        setOpen(true);
        setSaving(true);
      }
    }
  }, [saveRequestKey]);

  function applyItem(item: NamedLeadFilter) {
    const params = new URLSearchParams(item.query);
    start(() => router.push(`${path}?${params.toString()}`));
    setOpen(false);
  }

  async function saveNew() {
    const res = await fetch(`/api/table-views/${pageKey}/named-filters`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, shared: canManageShared && shared, query: currentQuery })
    });
    if (!res.ok) return;
    const json = (await res.json()) as { item: NamedLeadFilter };
    setList((prev) => [...prev, json.item].sort((a, b) => a.name.localeCompare(b.name)));
    setSaving(false);
    setName("");
    setShared(false);
  }

  async function remove(item: NamedLeadFilter) {
    const res = await fetch(
      `/api/table-views/${pageKey}/named-filters?id=${encodeURIComponent(item.id)}`,
      { method: "DELETE" }
    );
    if (!res.ok) return;
    setList((prev) => prev.filter((f) => f.id !== item.id));
  }

  async function rename(item: NamedLeadFilter) {
    const next = window.prompt("Rename filter", item.name);
    if (!next || next.trim() === item.name) return;
    const res = await fetch(`/api/table-views/${pageKey}/named-filters`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, name: next.trim() })
    });
    if (!res.ok) return;
    const json = (await res.json()) as { item: NamedLeadFilter };
    setList((prev) => prev.map((f) => (f.id === item.id ? json.item : f)));
  }

  async function update(item: NamedLeadFilter) {
    const res = await fetch(`/api/table-views/${pageKey}/named-filters`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, query: currentQuery })
    });
    if (!res.ok) return;
    const json = (await res.json()) as { item: NamedLeadFilter };
    setList((prev) => prev.map((f) => (f.id === item.id ? json.item : f)));
  }

  const personal = list.filter((f) => !f.shared);
  const team = list.filter((f) => f.shared);

  return (
    <ActionPopover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSaving(false);
      }}
      placement="bottom-end"
      role="menu"
      widthClass="w-72"
      bodyClassName="p-2"
      trigger={
        <ToolbarGhostButton
          testId="cf-saved"
          label="Views"
          icon={<ViewsIcon />}
          onClick={() => setOpen((v) => !v)}
        />
      }
    >
      <div data-testid="cf-saved-menu" className="text-xs">
          {personal.length === 0 && team.length === 0 ? (
            <p className="px-1 py-2 text-muted">No saved views yet.</p>
          ) : null}
          {personal.length > 0 ? (
            <p className="px-1 text-[10px] font-medium uppercase text-muted">Yours</p>
          ) : null}
          {personal.map((item) => (
            <SavedRow
              key={item.id}
              item={item}
              canEdit={managing}
              onApply={() => applyItem(item)}
              onRename={() => void rename(item)}
              onUpdate={() => void update(item)}
              onDelete={() => void remove(item)}
            />
          ))}
          {team.length > 0 ? (
            <p className="mt-2 px-1 text-[10px] font-medium uppercase text-muted">
              Shared with team
            </p>
          ) : null}
          {team.map((item) => (
            <SavedRow
              key={item.id}
              item={item}
              canEdit={managing && canManageShared}
              onApply={() => applyItem(item)}
              onRename={() => void rename(item)}
              onUpdate={() => void update(item)}
              onDelete={() => void remove(item)}
            />
          ))}
          <div className="mt-2 space-y-1 border-t border-subtle pt-2">
            {saving ? (
              <div className="space-y-2">
                <input
                  autoFocus
                  data-testid="cf-save-name"
                  className="h-8 w-full rounded-sm border border-subtle px-2"
                  placeholder="View name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void saveNew();
                  }}
                />
                {canManageShared ? (
                  <label className="flex items-center gap-1.5 text-muted">
                    <input
                      type="checkbox"
                      checked={shared}
                      onChange={(e) => setShared(e.target.checked)}
                    />
                    Shared with team
                  </label>
                ) : null}
                <button
                  type="button"
                  data-testid="cf-save-confirm"
                  className="rounded-sm bg-accent-soft px-2 py-1 font-medium text-fg"
                  onClick={() => void saveNew()}
                >
                  Save
                </button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  data-testid="cf-save-as"
                  className="block w-full rounded-sm px-1 py-1 text-left text-fg hover:bg-surface-2"
                  onClick={() => setSaving(true)}
                >
                  Save current view…
                </button>
                {personal.length > 0 || team.length > 0 ? (
                  <button
                    type="button"
                    data-testid="cf-manage-views"
                    className="block w-full rounded-sm px-1 py-1 text-left text-fg hover:bg-surface-2"
                    onClick={() => setManaging((v) => !v)}
                  >
                    {managing ? "Done" : "Manage views"}
                  </button>
                ) : null}
                {columnsSlot}
              </>
            )}
          </div>
      </div>
    </ActionPopover>
  );
}

function SavedRow({
  item,
  canEdit,
  onApply,
  onRename,
  onUpdate,
  onDelete
}: {
  item: NamedLeadFilter;
  canEdit: boolean;
  onApply: () => void;
  onRename: () => void;
  onUpdate: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-1 py-0.5">
      <button
        type="button"
        data-testid={`cf-saved-item-${item.id}`}
        className="min-w-0 flex-1 truncate rounded-sm px-1 py-1 text-left text-fg hover:bg-surface-2"
        onClick={onApply}
      >
        {item.name}
      </button>
      {canEdit ? (
        <>
          <button type="button" className="text-muted hover:text-fg" onClick={onRename}>
            Rename
          </button>
          <button type="button" className="text-muted hover:text-fg" onClick={onUpdate}>
            Update
          </button>
          <button type="button" className="text-muted hover:text-fg" onClick={onDelete}>
            Delete
          </button>
        </>
      ) : null}
    </div>
  );
}
