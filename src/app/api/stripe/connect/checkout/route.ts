import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import type { Patient, PatientLink, SubscriptionPlan } from "@/lib/types";

/** Checkout de assinatura do PACIENTE para um plano do nutricionista — cobrado direto na conta Stripe conectada dele. */
export async function POST(request: Request) {
  const { slug, planId } = await request.json().catch(() => ({}));
  if (!slug || !planId) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const cookieStore = await cookies();
  if (cookieStore.get(`pl_${slug}`)?.value !== "granted") {
    return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: link } = await supabase
    .from("patient_links")
    .select("*, patient:patients(*, nutritionist:nutritionists(*))")
    .eq("slug", slug)
    .single<PatientLink & { patient: Patient & { nutritionist: { id: string; stripe_connect_account_id: string | null } } }>();
  if (!link) return NextResponse.json({ error: "Link inválido." }, { status: 404 });

  const { data: plan } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("id", planId)
    .eq("nutritionist_id", link.patient.nutritionist.id)
    .eq("active", true)
    .single<SubscriptionPlan>();
  if (!plan?.stripe_price_id) return NextResponse.json({ error: "Plano indisponível." }, { status: 404 });

  const connectAccountId = link.patient.nutritionist.stripe_connect_account_id;
  if (!connectAccountId) return NextResponse.json({ error: "Nutricionista sem conta de pagamento conectada." }, { status: 400 });

  const session = await stripe.checkout.sessions.create(
    {
      mode: "subscription",
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      customer_email: link.patient.email ?? undefined,
      subscription_data: {
        metadata: { patient_id: link.patient.id, plan_id: plan.id, nutritionist_id: link.patient.nutritionist.id },
      },
      metadata: { patient_id: link.patient.id, plan_id: plan.id, nutritionist_id: link.patient.nutritionist.id },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/p/${slug}?assinatura=sucesso`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/p/${slug}?assinatura=cancelada`,
    },
    { stripeAccount: connectAccountId }
  );

  return NextResponse.json({ url: session.url });
}
