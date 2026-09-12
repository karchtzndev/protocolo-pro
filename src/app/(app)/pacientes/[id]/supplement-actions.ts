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

  if (catalogItem?.max_daily_dose) {
    const { data: existing } = await supabase
      .from("patient_supplements")
      .select("dose")
      .eq("patient_id", patientId)
      .eq("supplement_id", supplementId);

    const alreadyPrescribed = (existing ?? []).reduce((sum, e) => sum + Number(e.dose), 0);
    const combinedDose = alreadyPrescribed + dose;

    if (combinedDose > catalogItem.max_daily_dose && !justification) {
      throw new Error(
        alreadyPrescribed > 0
          ? `Dose combinada (${alreadyPrescribed} + ${dose} = ${combinedDose} ${catalogItem.dose_unit}/dia) ultrapassa o limite superior tolerável de ${catalogItem.max_daily_dose} ${catalogItem.dose_unit}/dia — já há prescrição deste suplemento para o paciente. Registre uma justificativa para prosseguir.`
          : `Dose acima do limite superior tolerável (${catalogItem.max_daily_dose} ${catalogItem.dose_unit}/dia). Registre uma justificativa para prosseguir.`
      );
    }
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

  const [{ data: items }, { data: alreadyPrescribed }] = await Promise.all([
    supabase.from("supplement_preset_items").select("*").eq("preset_id", presetId),
    supabase.from("patient_supplements").select("supplement_id").eq("patient_id", patientId),
  ]);

  if (!items?.length) return;

  const existingIds = new Set((alreadyPrescribed ?? []).map((p) => p.supplement_id));
  const rows = items
    .filter((item) => !existingIds.has(item.supplement_id))
    .map((item) => ({
      patient_id: patientId,
      supplement_id: item.supplement_id,
      dose: item.dose,
      dose_unit: item.dose_unit,
      schedule: item.schedule,
    }));

  if (!rows.length) return;

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
