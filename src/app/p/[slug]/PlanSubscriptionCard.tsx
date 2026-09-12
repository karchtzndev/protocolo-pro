"use client";

import { useState } from "react";
import type { PatientSubscription, SubscriptionPlan } from "@/lib/types";

const STATUS_LABELS: Record<string, string> = {
  trialing: "em teste",
  active: "ativa",
  past_due: "pagamento pendente",
  incomplete: "pendente",
  canceled: "cancelada",
};

export function PlanSubscriptionCard({
  slug,
  plans,
  subscription,
}: {
  slug: string;
  plans: SubscriptionPlan[];
  subscription: PatientSubscription | null;
}) {
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(planId: string) {
    setLoadingPlanId(planId);
    setError(null);
    const res = await fetch("/api/stripe/connect/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, planId }),
    });
    const { url, error: err } = await res.json();
    if (err) {
      setError(err);
      setLoadingPlanId(null);
      return;
    }
    window.location.href = url;
  }

  if (subscription) {
    return (
      <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[0_8px_30px_rgba(27,33,29,.1)]">
        <h4 className="mb-2 text-[13.5px] font-semibold">📋 Seu plano de acompanhamento</h4>
        <div className="flex items-center justify-between text-sm">
          <span>{subscription.plan?.name}</span>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent-strong">
            {STATUS_LABELS[subscription.status] ?? subscription.status}
          </span>
        </div>
        {subscription.current_period_end && (
          <p className="mt-1.5 text-xs text-[var(--ink-soft)]">
            Renova em {new Date(subscription.current_period_end).toLocaleDateString("pt-BR")}
          </p>
        )}
      </div>
    );
  }

  if (!plans.length) return null;

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[0_8px_30px_rgba(27,33,29,.1)]">
      <h4 className="mb-2.5 text-[13.5px] font-semibold">📋 Planos de acompanhamento</h4>
      <div className="flex flex-col gap-2">
        {plans.map((plan) => (
          <div key={plan.id} className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] p-3">
            <div>
              <b className="block text-sm">{plan.name}</b>
              {plan.description && <span className="text-xs text-[var(--ink-soft)]">{plan.description}</span>}
              <span className="mt-1 block font-mono-data text-sm font-bold text-brand">
                R$ {(plan.price_cents / 100).toFixed(2)} / {plan.interval === "month" ? "mês" : "trimestre"}
              </span>
            </div>
            <button
              type="button"
              disabled={loadingPlanId === plan.id}
              onClick={() => subscribe(plan.id)}
              className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-bold text-brand-on disabled:opacity-60"
            >
              {loadingPlanId === plan.id ? "..." : "Assinar"}
            </button>
          </div>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
