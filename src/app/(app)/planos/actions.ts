"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { stripe } from "@/lib/stripe";

export async function createSubscriptionPlan(formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("stripe_connect_account_id, stripe_connect_onboarded")
    .eq("id", user.id)
    .single();

  if (!nutritionist?.stripe_connect_onboarded || !nutritionist.stripe_connect_account_id) {
    throw new Error("Conecte sua conta Stripe em Configurações antes de criar planos.");
  }

  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim() || null;
  const priceCents = Math.round(Number(formData.get("price_reais")) * 100);
  const interval = String(formData.get("interval") || "month") as "month" | "quarter";

  if (!name || !priceCents || priceCents <= 0) throw new Error("Nome e preço válidos são obrigatórios.");

  const connectOptions = { stripeAccount: nutritionist.stripe_connect_account_id };

  const product = await stripe.products.create({ name, description: description ?? undefined }, connectOptions);
  const price = await stripe.prices.create(
    {
      product: product.id,
      currency: "brl",
      unit_amount: priceCents,
      recurring: { interval: interval === "quarter" ? "month" : "month", interval_count: interval === "quarter" ? 3 : 1 },
    },
    connectOptions
  );

  const { error } = await supabase.from("subscription_plans").insert({
    nutritionist_id: user.id,
    name,
    description,
    price_cents: priceCents,
    interval,
    stripe_product_id: product.id,
    stripe_price_id: price.id,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/planos");
}

export async function togglePlanActive(planId: string, active: boolean) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("subscription_plans")
    .update({ active })
    .eq("id", planId)
    .eq("nutritionist_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/planos");
}
