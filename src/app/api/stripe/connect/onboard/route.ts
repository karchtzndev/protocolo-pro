import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { createConnectAccountV2 } from "@/lib/stripeAccountsV2";

/**
 * Cria (se ainda não existir) a conta Stripe Connect Standard do nutricionista
 * e devolve o link de onboarding. Standard = o próprio nutricionista assume
 * KYC, repasses e dashboard fiscal no Stripe; o Protocolo.Pro nunca custodia
 * o dinheiro do paciente.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("stripe_connect_account_id, full_name, clinic_name")
    .eq("id", user.id)
    .single();

  let accountId = nutritionist?.stripe_connect_account_id as string | null;

  if (!accountId) {
    accountId = await createConnectAccountV2({
      email: user.email,
      displayName: nutritionist?.clinic_name ?? nutritionist?.full_name ?? "Nutricionista",
      nutritionistId: user.id,
    });
    await supabase.from("nutritionists").update({ stripe_connect_account_id: accountId }).eq("id", user.id);
  }

  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?connect=retomar`,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?connect=concluido`,
    type: "account_onboarding",
  });

  return NextResponse.json({ url: accountLink.url });
}
