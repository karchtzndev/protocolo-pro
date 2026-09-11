import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!nutritionist?.stripe_customer_id) {
    return NextResponse.json({ error: "Nenhuma assinatura encontrada." }, { status: 400 });
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: nutritionist.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes`,
  });

  return NextResponse.json({ url: session.url });
}
