import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { priceIdFor, type BillingPlan, type BillingInterval } from "@/lib/billingPlans";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const plan: BillingPlan = body.plan === "clinica" ? "clinica" : "solo";
  const interval: BillingInterval = body.interval === "anual" ? "anual" : "mensal";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("stripe_customer_id, full_name")
    .eq("id", user.id)
    .single();

  let customerId = nutritionist?.stripe_customer_id as string | null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email,
      name: nutritionist?.full_name,
      metadata: { nutritionist_id: user.id },
    });
    customerId = customer.id;
    await supabase.from("nutritionists").update({ stripe_customer_id: customerId }).eq("id", user.id);
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceIdFor(plan, interval), quantity: 1 }],
    subscription_data: { trial_period_days: 7, metadata: { nutritionist_id: user.id, plan } },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?checkout=sucesso`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?checkout=cancelado`,
    metadata: { nutritionist_id: user.id, plan },
  });

  return NextResponse.json({ url: session.url });
}
