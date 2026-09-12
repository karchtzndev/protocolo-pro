"use server";

import { redirect } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";

function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(" ")[0]
    .replace(/[^a-z0-9]/g, "") || "paciente";
}

function randomToken(length: number) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

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

  const slug = `${slugify(fullName)}-${randomToken(4)}`;
  const pin = birthDate.replace(/-/g, "").slice(4);

  const { error: linkError } = await supabase.from("patient_links").insert({
    patient_id: patient.id,
    slug,
    pin_last4_birthdate: pin,
    expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
  });
  if (linkError) throw new Error(linkError.message);

  redirect(`/p/${slug}`);
}
