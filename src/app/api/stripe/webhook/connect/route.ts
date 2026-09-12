import { NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import { createServiceRoleClient } from "@/lib/supabase/server";

const STATUS_MAP: Record<Stripe.Subscription.Status, string> = {
  trialing: "trialing",
  active: "active",
  past_due: "past_due",
  canceled: "canceled",
  incomplete: "incomplete",
  incomplete_expired: "canceled",
  unpaid: "past_due",
  paused: "canceled",
};

/** Eventos originados nas contas Stripe Connect dos nutricionistas (assinaturas dos pacientes deles). */
export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_CONNECT_WEBHOOK_SECRET!);
  } catch (err) {
    return NextResponse.json({ error: `Assinatura inválida: ${(err as Error).message}` }, { status: 400 });
  }

  const supabase = createServiceRoleClient();

  const { error: dedupError } = await supabase.from("stripe_events").insert({ id: event.id, type: event.type });
  if (dedupError) return NextResponse.json({ received: true, deduplicated: true });

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const { patient_id, plan_id, nutritionist_id } = session.metadata ?? {};
      if (patient_id && plan_id && nutritionist_id && session.subscription) {
        await supabase.from("patient_subscriptions").upsert(
          {
            patient_id,
            plan_id,
            nutritionist_id,
            stripe_subscription_id: session.subscription as string,
            stripe_customer_id: session.customer as string,
            status: "active",
          },
          { onConflict: "stripe_subscription_id" }
        );
      }
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await supabase
        .from("patient_subscriptions")
        .update({
          status: STATUS_MAP[subscription.status] ?? "past_due",
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
