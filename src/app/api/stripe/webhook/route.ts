import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { planForPriceId } from "@/lib/billingPlans";

const STATUS_MAP: Record<Stripe.Subscription.Status, string> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "past_due",
  incomplete_expired: "canceled",
  unpaid: "past_due",
  paused: "canceled",
};

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Assinatura inválida: ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  // Deduplicação: o Stripe pode reentregar o mesmo evento mais de uma vez.
  const { error: dedupError } = await supabase.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dedupError) {
    // Violação de chave primária = evento já processado antes.
    return NextResponse.json({ received: true, deduplicated: true });
  }

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const priceId = subscription.items.data[0]?.price.id;
      const plan = priceId ? planForPriceId(priceId) : null;

      await supabase
        .from("nutritionists")
        .update({
          stripe_subscription_id: subscription.id,
          subscription_status: STATUS_MAP[subscription.status] ?? "past_due",
          ...(plan ? { plan } : {}),
        })
        .eq("stripe_customer_id", subscription.customer as string);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
