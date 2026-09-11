"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { PLAN_LABELS, type BillingPlan, type BillingInterval } from "@/lib/billingPlans";

export function BillingButtons({ hasSubscription, currentPlan }: { hasSubscription: boolean; currentPlan: BillingPlan }) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<BillingPlan>(currentPlan);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("mensal");

  async function go(endpoint: string, body?: object) {
    setLoading(true);
    const res = await fetch(endpoint, { method: "POST", body: body ? JSON.stringify(body) : undefined });
    const { url, error } = await res.json();
    if (error) {
      alert(error);
      setLoading(false);
      return;
    }
    window.location.href = url;
  }

  if (hasSubscription) {
    return (
      <div className="mt-2.5">
        <Button variant="ghost" size="sm" disabled={loading} onClick={() => go("/api/stripe/portal")}>
          Gerenciar assinatura
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {(Object.entries(PLAN_LABELS) as [BillingPlan, (typeof PLAN_LABELS)[BillingPlan]][]).map(([key, info]) => (
          <button
            key={key}
            type="button"
            onClick={() => setPlan(key)}
            className={`rounded-lg border p-3 text-left text-xs ${
              plan === key ? "border-brand bg-accent-soft" : "border-[var(--border)] bg-[var(--surface-2)]"
            }`}
          >
            <span className="block text-sm font-bold">{info.name} — R$ {info.monthlyPriceBRL}/mês</span>
            <ul className="mt-1.5 space-y-0.5 text-[var(--ink-soft)]">
              {info.features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
          </button>
        ))}
      </div>

      <div className="mb-3 flex gap-2">
        {(["mensal", "anual"] as BillingInterval[]).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setBillingInterval(i)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold ${
              billingInterval === i ? "border-brand bg-brand text-brand-on" : "border-[var(--border)] text-[var(--ink-soft)]"
            }`}
          >
            {i === "mensal" ? "Mensal" : "Anual (desconto)"}
          </button>
        ))}
      </div>

      <Button disabled={loading} onClick={() => go("/api/stripe/checkout", { plan, interval: billingInterval })}>
        Assinar plano {PLAN_LABELS[plan].name} — teste grátis de 7 dias
      </Button>
    </div>
  );
}
