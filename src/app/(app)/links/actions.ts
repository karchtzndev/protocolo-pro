"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";
import { slugify, randomToken, pinFromBirthDate } from "@/lib/patientLinks";

export async function createLink(formData: FormData) {
  await requireActiveSubscription();
  const supabase = await createClient();
  const patientId = String(formData.get("patient_id"));

  const { data: patient } = await supabase.from("patients").select("full_name, birth_date").eq("id", patientId).single();
  if (!patient) throw new Error("Paciente não encontrado.");

  const slug = `${slugify(patient.full_name)}-${randomToken(4)}`;

  const expiresInDays = Number(formData.get("expires_in_days") || 90);
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("patient_links").insert({
    patient_id: patientId,
    slug,
    pin_last4_birthdate: pinFromBirthDate(patient.birth_date),
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/links");
}

export async function revokeLink(formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();
  const linkId = String(formData.get("link_id"));
  await supabase.from("patient_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId);
  await logAudit(user.id, "protocolo.revogar_link", { targetType: "patient_link", targetId: linkId });
  revalidatePath("/links");
}
