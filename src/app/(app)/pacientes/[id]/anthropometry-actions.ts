"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";

function numOrNull(value: FormDataEntryValue | null) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && String(value).trim() !== "" ? n : null;
}

export async function saveAnthropometry(patientId: string, formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const weightKg = numOrNull(formData.get("weight_kg"));
  const heightM = numOrNull(formData.get("height_m"));
  if (weightKg === null || heightM === null) {
    throw new Error("Peso e altura são obrigatórios.");
  }

  const payload = {
    patient_id: patientId,
    activity_level: String(formData.get("activity_level") || "moderado"),
    weight_kg: weightKg,
    height_m: heightM > 9.99 ? Math.round((heightM / 100) * 100) / 100 : heightM,
    lean_mass_kg: numOrNull(formData.get("lean_mass_kg")),
    neck_cm: numOrNull(formData.get("neck_cm")),
    waist_cm: numOrNull(formData.get("waist_cm")),
    hip_cm: numOrNull(formData.get("hip_cm")),
    skinfold_chest_mm: numOrNull(formData.get("skinfold_chest_mm")),
    skinfold_midaxillary_mm: numOrNull(formData.get("skinfold_midaxillary_mm")),
    skinfold_triceps_mm: numOrNull(formData.get("skinfold_triceps_mm")),
    skinfold_subscapular_mm: numOrNull(formData.get("skinfold_subscapular_mm")),
    skinfold_abdominal_mm: numOrNull(formData.get("skinfold_abdominal_mm")),
    skinfold_suprailiac_mm: numOrNull(formData.get("skinfold_suprailiac_mm")),
    skinfold_thigh_mm: numOrNull(formData.get("skinfold_thigh_mm")),
    skinfold_bicep_mm: numOrNull(formData.get("skinfold_bicep_mm")),
    notes: String(formData.get("notes") || "") || null,
  };

  const { error } = await supabase.from("anthropometry_records").insert(payload);
  if (error) throw new Error(error.message);

  await logAudit(user.id, "antropometria.registrar", { targetType: "patient", targetId: patientId });

  revalidatePath(`/pacientes/${patientId}`);
}
