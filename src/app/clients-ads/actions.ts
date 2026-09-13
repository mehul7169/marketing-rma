"use server";

import { revalidatePath } from "next/cache";
import { requireOrgId } from "@/lib/auth/getCurrentOrgId";
import { requirePlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import {
  deleteClientAdAccount,
  updateAdAccountClientName
} from "@/lib/db/ad_accounts";

export async function renameClientAdAccount(id: string, clientName: string) {
  await requirePlatformAdmin();
  const orgId = await requireOrgId();
  const updated = await updateAdAccountClientName(id, clientName, orgId);
  revalidatePath("/clients-ads");
  revalidatePath(`/clients-ads/${id}`);
  return { client_name: updated.client_name };
}

export async function removeClientAdAccount(id: string) {
  await requirePlatformAdmin();
  const orgId = await requireOrgId();
  const removed = await deleteClientAdAccount(id, orgId);
  revalidatePath("/clients-ads");
  revalidatePath(`/clients-ads/${id}`);
  return removed;
}
