"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { AdminActionState } from "@/lib/admin/action-state";
import { requireRole } from "@/lib/auth/require-role";
import {
  CampaignStateError,
  cancelCampaign,
  createCampaign,
  parseCampaignInput,
  scheduleCampaign,
  scheduleProblem,
  sendTestCampaign,
  updateCampaign,
} from "@/lib/newsletter/campaigns";

/** Admin-only. Every action re-checks the role. The layout check is not enough on its own. */

const CAMPAIGN_PATHS = ["/admin/newsletter", "/admin/newsletter/campaigns"];

function revalidateCampaign(id: string): void {
  for (const path of CAMPAIGN_PATHS) revalidatePath(path);
  revalidatePath(`/admin/newsletter/campaigns/${id}`);
}

function campaignIdFrom(formData: FormData): string | null {
  const id = formData.get("id");
  return typeof id === "string" && /^[a-z0-9]{10,40}$/i.test(id) ? id : null;
}

export async function createCampaignAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const parsed = parseCampaignInput({
    subject: formData.get("subject"),
    preheader: formData.get("preheader"),
    body: formData.get("body"),
    topics: formData.getAll("topics"),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const created = await createCampaign(parsed.value, admin.id);
  revalidateCampaign(created.id);
  redirect(`/admin/newsletter/campaigns/${created.id}`);
}

export async function updateCampaignAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireRole(["ADMIN"]);
  const id = campaignIdFrom(formData);
  if (!id) return { ok: false, error: "Campaign not found." };
  const parsed = parseCampaignInput({
    subject: formData.get("subject"),
    preheader: formData.get("preheader"),
    body: formData.get("body"),
    topics: formData.getAll("topics"),
  });
  if (!parsed.ok) return { ok: false, error: parsed.error };
  try {
    await updateCampaign(id, parsed.value);
  } catch (error) {
    if (error instanceof CampaignStateError) return { ok: false, error: error.message };
    throw error;
  }
  revalidateCampaign(id);
  return { ok: true, message: "Campaign saved." };
}

/** Accepts "YYYY-MM-DDTHH:MM" as UTC. The form says so, so there is no time zone guessing. */
export async function scheduleCampaignAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  await requireRole(["ADMIN"]);
  const id = campaignIdFrom(formData);
  if (!id) return { ok: false, error: "Campaign not found." };
  const raw = formData.get("scheduledFor");
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(raw)) {
    return { ok: false, error: "Enter the send time as YYYY-MM-DDTHH:MM in UTC." };
  }
  const at = new Date(`${raw}:00Z`);
  const problem = scheduleProblem(at, new Date());
  if (problem) return { ok: false, error: problem };
  try {
    await scheduleCampaign(id, at);
  } catch (error) {
    if (error instanceof CampaignStateError) return { ok: false, error: error.message };
    throw error;
  }
  revalidateCampaign(id);
  return { ok: true, message: `Scheduled for ${at.toISOString()}. The worker sends it at the next run after that time.` };
}

export async function cancelCampaignAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const id = campaignIdFrom(formData);
  if (!id) return { ok: false, error: "Campaign not found." };
  try {
    await cancelCampaign(id, admin.id);
  } catch (error) {
    if (error instanceof CampaignStateError) return { ok: false, error: error.message };
    throw error;
  }
  revalidateCampaign(id);
  return { ok: true, message: "Campaign cancelled." };
}

export async function sendTestCampaignAction(_prev: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const admin = await requireRole(["ADMIN"]);
  const id = campaignIdFrom(formData);
  if (!id) return { ok: false, error: "Campaign not found." };
  try {
    await sendTestCampaign(id, { id: admin.id, email: admin.email });
  } catch (error) {
    if (error instanceof CampaignStateError) return { ok: false, error: error.message };
    throw error;
  }
  revalidateCampaign(id);
  return { ok: true, message: `Test sent to ${admin.email}.` };
}
