"use server";

import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AnamnesisResponses } from "@/lib/types";

const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 4; // 4 horas

export async function acceptConsent(slug: string) {
  const supabase = createServiceRoleClient();
  await supabase
    .from("patient_links")
    .update({ consent_accepted_at: new Date().toISOString() })
    .eq("slug", slug);
}

export async function verifyPin(slug: string, pin: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createServiceRoleClient();
  const { data: link } = await supabase
    .from("patient_links")
    .select("pin_last4_birthdate, revoked_at, expires_at")
    .eq("slug", slug)
    .single();

  if (!link) return { ok: false, error: "Link não encontrado." };
  if (link.revoked_at) return { ok: false, error: "Este link foi revogado pelo nutricionista." };
  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return { ok: false, error: "Este link expirou." };
  }
  if (link.pin_last4_birthdate !== pin) return { ok: false, error: "PIN incorreto." };

  const cookieStore = await cookies();
  cookieStore.set(`pl_${slug}`, "granted", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: ACCESS_COOKIE_MAX_AGE,
    path: "/",
  });

  return { ok: true };
}

export async function submitAnamnesis(slug: string, anamnesisId: string, formData: FormData) {
  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(`pl_${slug}`)?.value === "granted";
  if (!hasAccess) throw new Error("Sessão expirada — confirme o PIN novamente.");

  const alimentosHabituais = formData.getAll("alimentos_habituais").map(String);
  const alimentosIntolerancia = formData.getAll("alimentos_intolerancia").map(String);

  const responses: AnamnesisResponses = {
    alimentos_habituais: alimentosHabituais.length ? alimentosHabituais : undefined,
    alimentos_intolerancia: alimentosIntolerancia.length ? alimentosIntolerancia : undefined,
    habitos_alimentares: String(formData.get("habitos_alimentares") || "") || undefined,
    historico_familiar: String(formData.get("historico_familiar") || "") || undefined,
    atividade_fisica: String(formData.get("atividade_fisica") || "") || undefined,
    qualidade_sono: String(formData.get("qualidade_sono") || "") || undefined,
    uso_medicamentos: String(formData.get("uso_medicamentos") || "") || undefined,
    alergias_intolerancias: String(formData.get("alergias_intolerancias") || "") || undefined,
    tabagismo_alcool: String(formData.get("tabagismo_alcool") || "") || undefined,
    observacoes: String(formData.get("observacoes") || "") || undefined,
  };

  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("anamnesis_responses")
    .update({ responses, status: "preenchido", submitted_at: new Date().toISOString() })
    .eq("id", anamnesisId);
  if (error) throw new Error(error.message);
}
