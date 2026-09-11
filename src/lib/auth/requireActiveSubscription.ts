import { createClient } from "@/lib/supabase/server";

/**
 * Guard de servidor — chamado no início de toda mutação que altera dados.
 * Não depende do front-end: mesmo que a UI esconda botões para assinaturas
 * inativas, a mutação em si recusa a execução aqui.
 */
export async function requireActiveSubscription() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado.");

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("subscription_status")
    .eq("id", user.id)
    .single();

  if (!nutritionist || !["trialing", "active"].includes(nutritionist.subscription_status)) {
    throw new Error("Assinatura inativa. Regularize o pagamento em Configurações para continuar.");
  }

  return user;
}
