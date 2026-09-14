"use server";

import { revalidatePath } from "next/cache";
import { requirePlatformAdmin } from "@/lib/auth/isPlatformAdmin";
import {
  deleteClientAdAccount,
  updateAdAccountClientName
} from "@/lib/db/ad_accounts";

export async function renameClientAdAccount(id: string, clientName: string) {
  await requirePlatformAdmin();
  const updated = await updateAdAccountClientName(id, clientName);
  revalidatePath("/clients-ads");
  revalidatePath(`/clients-ads/${id}`);
  return { client_name: updated.client_name };
}

export async function removeClientAdAccount(id: string) {
  await requirePlatformAdmin();
  const removed = await deleteClientAdAccount(id);
  revalidatePath("/clients-ads");
  revalidatePath(`/clients-ads/${id}`);
  return removed;
}
