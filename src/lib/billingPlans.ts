export type BillingPlan = "solo" | "clinica";
export type BillingInterval = "mensal" | "anual";

export const PLAN_LABELS: Record<BillingPlan, { name: string; monthlyPriceBRL: number; features: string[] }> = {
  solo: {
    name: "Solo",
    monthlyPriceBRL: 79,
    features: ["Protocolos ilimitados", "Composição corporal", "Suplementação", "Até 40 pacientes"],
  },
  clinica: {
    name: "Clínica",
    monthlyPriceBRL: 249,
    features: ["Tudo do Solo", "Vários profissionais", "Exportação em massa", "Pacientes ilimitados"],
  },
};

export function priceIdFor(plan: BillingPlan, interval: BillingInterval): string {
  const key = `NEXT_PUBLIC_STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`;
  const value = process.env[key];
  if (!value) throw new Error(`Variável de ambiente ${key} não configurada.`);
  return value;
}

/** Mapeia um price_id do Stripe de volta para plano — usado no webhook para sincronizar `nutritionists.plan`. */
export function planForPriceId(priceId: string): BillingPlan | null {
  const plans: BillingPlan[] = ["solo", "clinica"];
  const intervals: BillingInterval[] = ["mensal", "anual"];
  for (const plan of plans) {
    for (const interval of intervals) {
      if (process.env[`NEXT_PUBLIC_STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`] === priceId) {
        return plan;
      }
    }
  }
  return null;
}
