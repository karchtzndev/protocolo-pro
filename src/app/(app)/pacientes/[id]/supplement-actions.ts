"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";
import type { SupplementCatalogItem } from "@/lib/types";

export async function prescribeSupplement(patientId: string, formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const supplementId = String(formData.get("supplement_id") || "");
  const dose = Number(formData.get("dose"));
  const doseUnit = String(formData.get("dose_unit") || "");
  const schedule = String(formData.get("schedule") || "");
  const justification = String(formData.get("justification") || "") || null;

  if (!supplementId || !Number.isFinite(dose) || dose <= 0 || !doseUnit || !schedule) {
    throw new Error("Preencha suplemento, dose, unidade e horário.");
  }

  const { data: catalogItem } = await supabase
    .from("supplements_catalog")
    .select("*")
    .eq("id", supplementId)
    .single<SupplementCatalogItem>();

  if (catalogItem?.max_daily_dose && dose > catalogItem.max_daily_dose && !justification) {
    throw new Error(
      `Dose acima do limite superior tolerável (${catalogItem.max_daily_dose} ${catalogItem.dose_unit}/dia). Registre uma justificativa para prosseguir.`
    );
  }

  const { error } = await supabase.from("patient_supplements").insert({
    patient_id: patientId,
    supplement_id: supplementId,
    dose,
    dose_unit: doseUnit,
    schedule,
    justification,
  });
  if (error) throw new Error(error.message);

  await logAudit(user.id, "suplementacao.salvar", { targetType: "patient", targetId: patientId });

  revalidatePath(`/pacientes/${patientId}`);
}

export async function applySupplementPreset(patientId: string, presetId: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("supplement_preset_items")
    .select("*")
    .eq("preset_id", presetId);

  if (!items?.length) return;

  const rows = items.map((item) => ({
    patient_id: patientId,
    supplement_id: item.supplement_id,
    dose: item.dose,
    dose_unit: item.dose_unit,
    schedule: item.schedule,
  }));

  const { error } = await supabase.from("patient_supplements").insert(rows);
  if (error) throw new Error(error.message);

  await logAudit(user.id, "suplementacao.salvar", { targetType: "patient", targetId: patientId, metadata: { presetId } });

  revalidatePath(`/pacientes/${patientId}`);
}

/** Assinatura da prescrição: registro imutável — um trigger no banco bloqueia edição após assinado. */
export async function signPrescription(patientId: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("patient_supplements")
    .update({ signed_at: new Date().toISOString(), signed_by: user.id })
    .eq("patient_id", patientId)
    .is("signed_at", null);

  if (error) throw new Error(error.message);

  await logAudit(user.id, "suplementacao.assinar", { targetType: "patient", targetId: patientId });

  revalidatePath(`/pacientes/${patientId}`);
}

export async function removeSupplement(patientId: string, supplementRowId: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("patient_supplements")
    .delete()
    .eq("id", supplementRowId)
    .is("signed_at", null);

  if (error) throw new Error(error.message);

  revalidatePath(`/pacientes/${patientId}`);
}
