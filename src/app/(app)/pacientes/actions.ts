"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";
import { createPatientAccess } from "@/lib/patientLinks";

export async function createPatient(formData: FormData): Promise<{ patientId: string; slug: string }> {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const fullName = String(formData.get("full_name"));
  const birthDate = String(formData.get("birth_date"));

  const { data: patient, error } = await supabase
    .from("patients")
    .insert({
      nutritionist_id: user.id,
      full_name: fullName,
      birth_date: birthDate,
      sex: String(formData.get("sex") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      email: String(formData.get("email") || "") || null,
      objective: String(formData.get("objective") || "") || null,
      status: "pendente",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  // Já deixa o acesso do portal pronto — a anamnese completa fica pendente
  // esperando o paciente preencher, sem o profissional precisar de um passo extra.
  const slug = await createPatientAccess(supabase, { patientId: patient.id, fullName, birthDate });

  revalidatePath("/pacientes");
  return { patientId: patient.id, slug };
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
