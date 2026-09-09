"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  deleteClientAdAccount,
  updateAdAccountClientName
} from "@/lib/db/ad_accounts";
import { SESSION_COOKIE, parseSessionRole } from "@/lib/auth/session";

async function requireAdmin() {
  const role = await parseSessionRole(
    cookies().get(SESSION_COOKIE)?.value,
    process.env.ROLE_SECRET
  );
  if (role !== "admin") throw new Error("Unauthorized");
}

export async function renameClientAdAccount(id: string, clientName: string) {
  await requireAdmin();
  const updated = await updateAdAccountClientName(id, clientName);
  revalidatePath("/clients-ads");
  revalidatePath(`/clients-ads/${id}`);
  return { client_name: updated.client_name };
}

export async function removeClientAdAccount(id: string) {
  await requireAdmin();
  const removed = await deleteClientAdAccount(id);
  revalidatePath("/clients-ads");
  revalidatePath(`/clients-ads/${id}`);
  return removed;
}
