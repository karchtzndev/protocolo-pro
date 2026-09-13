import type { SupabaseClient } from "@supabase/supabase-js";

export function slugify(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(" ")[0]
    .replace(/[^a-z0-9]/g, "") || "paciente";
}

export function randomToken(length: number) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

/** PIN de acesso do portal — últimos 4 dígitos da data de nascimento (MMDD). */
export function pinFromBirthDate(birthDate: string) {
  return birthDate.replace(/-/g, "").slice(4);
}

/** Cria só o link de acesso ao portal do paciente (sem mexer em anamnese). */
export async function createPatientLink(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  { patientId, fullName, birthDate, expiresInDays = 90 }: { patientId: string; fullName: string; birthDate: string; expiresInDays?: number }
): Promise<string> {
  const slug = `${slugify(fullName)}-${randomToken(4)}`;
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase.from("patient_links").insert({
    patient_id: patientId,
    slug,
    pin_last4_birthdate: pinFromBirthDate(birthDate),
    expires_at: expiresAt,
  });
  if (error) throw new Error(error.message);

  return slug;
}

/**
 * Cria o link de acesso ao portal do paciente e já deixa uma anamnese
 * pendente esperando — usado no cadastro para o paciente poder preencher
 * a ficha completa antes mesmo da primeira consulta.
 */
export async function createPatientAccess(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  params: { patientId: string; fullName: string; birthDate: string; expiresInDays?: number }
): Promise<string> {
  const slug = await createPatientLink(supabase, params);
  await supabase.from("anamnesis_responses").insert({ patient_id: params.patientId, appointment_id: null });
  return slug;
}
