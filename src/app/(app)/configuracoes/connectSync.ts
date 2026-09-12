import { stripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";

/**
 * O retorno do onboarding do Stripe Connect não garante que os dados foram
 * de fato aceitos (o nutricionista pode fechar a aba no meio do fluxo).
 * Consulta a conta na Stripe e persiste o status real sempre que a página de
 * configurações é aberta e o onboarding ainda não foi marcado como concluído.
 */
export async function syncConnectStatus(nutritionistId: string, accountId: string): Promise<boolean> {
  const account = await stripe.accounts.retrieve(accountId);
  const onboarded = !!account.details_submitted && !!account.charges_enabled;

  if (onboarded) {
    const supabase = await createClient();
    await supabase.from("nutritionists").update({ stripe_connect_onboarded: true }).eq("id", nutritionistId);
  }

  return onboarded;
}
