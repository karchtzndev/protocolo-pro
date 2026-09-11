"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

export async function requestAccountDeletion() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { error } = await supabase.from("account_deletion_requests").insert({ nutritionist_id: user.id });
  if (error) throw new Error(error.message);

  await logAudit(user.id, "conta.solicitar_exclusao", { targetType: "nutritionist", targetId: user.id });

  revalidatePath("/configuracoes");
}

export async function cancelAccountDeletion(requestId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { error } = await supabase
    .from("account_deletion_requests")
    .update({ status: "cancelada", cancelled_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("nutritionist_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/configuracoes");
}
