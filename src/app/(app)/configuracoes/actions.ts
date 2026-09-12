"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";

export async function updateProfile(formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  await supabase
    .from("nutritionists")
    .update({
      full_name: String(formData.get("full_name")),
      crn: String(formData.get("crn")),
    })
    .eq("id", user.id);

  await logAudit(user.id, "perfil.atualizar", { targetType: "nutritionist", targetId: user.id });

  revalidatePath("/configuracoes");
}

export async function updateBrand(formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  await supabase
    .from("nutritionists")
    .update({
      clinic_name: String(formData.get("clinic_name")),
      clinic_phone: String(formData.get("clinic_phone")),
      brand_primary_color: String(formData.get("brand_primary_color")),
      brand_accent_color: String(formData.get("brand_accent_color")),
    })
    .eq("id", user.id);

  await logAudit(user.id, "perfil.atualizar", { targetType: "nutritionist", targetId: user.id, metadata: { section: "brand" } });

  revalidatePath("/configuracoes");
}

export async function updateLogoUrl(logoUrl: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  await supabase.from("nutritionists").update({ logo_url: logoUrl }).eq("id", user.id);

  await logAudit(user.id, "perfil.atualizar", { targetType: "nutritionist", targetId: user.id, metadata: { section: "logo" } });

  revalidatePath("/configuracoes");
}
