"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";

export async function moveStage(patientId: string, stageId: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("patients")
    .update({ stage_id: stageId })
    .eq("id", patientId)
    .eq("nutritionist_id", user.id);
  if (error) throw new Error(error.message);

  await logAudit(user.id, "perfil.atualizar", {
    targetType: "patient",
    targetId: patientId,
    metadata: { action: "mover_estagio_crm", stage_id: stageId },
  });

  revalidatePath("/crm");
}

export async function updateTags(patientId: string, tagsCsv: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const tags = Array.from(
    new Set(
      tagsCsv
        .split(",")
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
    )
  );

  const { error } = await supabase
    .from("patients")
    .update({ tags })
    .eq("id", patientId)
    .eq("nutritionist_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/crm");
  revalidatePath("/broadcast");
}

/** Gera (ou regenera) o slug público de captação de leads do nutricionista. */
export async function ensureBookingSlug(): Promise<string> {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { data } = await supabase.from("nutritionists").select("booking_slug, full_name").eq("id", user.id).single();
  if (data?.booking_slug) return data.booking_slug;

  const base = (data?.full_name ?? "nutricionista")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;

  await supabase.from("nutritionists").update({ booking_slug: slug }).eq("id", user.id);
  revalidatePath("/crm");
  return slug;
}
