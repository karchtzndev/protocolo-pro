"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";
import type { WeeklyMenu } from "@/lib/types";

function numOrNull(value: FormDataEntryValue | null) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) && String(value).trim() !== "" ? n : null;
}

/**
 * height_m é numeric(3,2) no banco (máx. 9.99) — se alguém digitar a altura em
 * centímetros por engano (ex: 175), converte para metros em vez de estourar a coluna.
 */
function normalizeHeightM(value: FormDataEntryValue | null) {
  const n = numOrNull(value);
  if (n === null) return null;
  const meters = n > 9.99 ? n / 100 : n;
  return Math.round(Math.min(meters, 9.99) * 100) / 100;
}

function linesOf(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function saveProtocol(patientId: string, formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  let weekly_menu: WeeklyMenu = {};
  try {
    weekly_menu = JSON.parse(String(formData.get("weekly_menu") || "{}"));
  } catch {
    throw new Error("Cardápio inválido.");
  }

  const payload = {
    patient_id: patientId,
    weight_kg: numOrNull(formData.get("weight_kg")),
    height_m: normalizeHeightM(formData.get("height_m")),
    body_fat_pct: numOrNull(formData.get("body_fat_pct")),
    waist_cm: numOrNull(formData.get("waist_cm")),
    weekly_menu,
    shopping_list: linesOf(formData.get("shopping_list")),
    guidance: linesOf(formData.get("guidance")),
    active: true,
    is_draft: formData.get("is_draft") === "on",
  };

  await supabase.from("protocols").update({ active: false }).eq("patient_id", patientId).eq("active", true);

  const { error } = await supabase.from("protocols").insert(payload);
  if (error) {
    if (error.code === "22003") {
      throw new Error("Algum valor de antropometria está fora da faixa aceita (ex: altura deve ser em metros, como 1,75).");
    }
    throw new Error(error.message);
  }

  await logAudit(user.id, payload.is_draft ? "plano.criar" : "protocolo.publicar", {
    targetType: "patient",
    targetId: patientId,
  });

  revalidatePath(`/pacientes/${patientId}`);
}
