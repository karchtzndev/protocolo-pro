"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { createPatientAccess } from "@/lib/patientLinks";

/** Captura pública de lead — cria o paciente, seu estágio "lead" e um link de acesso, sem exigir login. */
export async function captureLead(bookingSlug: string, formData: FormData) {
  const supabase = createServiceRoleClient();

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("id")
    .eq("booking_slug", bookingSlug)
    .single();
  if (!nutritionist) throw new Error("Link de captação inválido.");

  const fullName = String(formData.get("full_name") || "").trim();
  const birthDate = String(formData.get("birth_date") || "");
  if (!fullName || !birthDate) throw new Error("Nome e data de nascimento são obrigatórios.");

  const { data: leadStage } = await supabase
    .from("crm_stages")
    .select("id")
    .eq("nutritionist_id", nutritionist.id)
    .eq("key", "lead")
    .single();

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      nutritionist_id: nutritionist.id,
      full_name: fullName,
      birth_date: birthDate,
      sex: String(formData.get("sex") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      email: String(formData.get("email") || "") || null,
      objective: String(formData.get("objective") || "") || null,
      status: "pendente",
      stage_id: leadStage?.id ?? null,
    })
    .select("id")
    .single();
  if (patientError) throw new Error(patientError.message);

  const slug = await createPatientAccess(supabase, { patientId: patient.id, fullName, birthDate });

  redirect(`/p/${slug}`);
}
