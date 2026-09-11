"use server";

import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";

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
