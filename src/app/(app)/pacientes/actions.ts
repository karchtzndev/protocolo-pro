"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";

export async function createPatient(formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase.from("patients").insert({
    nutritionist_id: user.id,
    full_name: String(formData.get("full_name")),
    birth_date: String(formData.get("birth_date")),
    sex: String(formData.get("sex") || "") || null,
    phone: String(formData.get("phone") || "") || null,
    email: String(formData.get("email") || "") || null,
    objective: String(formData.get("objective") || "") || null,
    status: "pendente",
  });

  if (error) throw new Error(error.message);

  revalidatePath("/pacientes");
}

/** Arquivamento é exclusão lógica — preserva histórico do paciente. */
export async function archivePatient(patientId: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase.from("patients").update({ status: "inativo" }).eq("id", patientId);
  if (error) throw new Error(error.message);

  await logAudit(user.id, "paciente.arquivar", { targetType: "patient", targetId: patientId });

  revalidatePath("/pacientes");
}

export async function updateClinicalFlags(patientId: string, flags: string[]) {
  await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase.from("patients").update({ clinical_flags: flags }).eq("id", patientId);
  if (error) throw new Error(error.message);

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/pacientes");
}
