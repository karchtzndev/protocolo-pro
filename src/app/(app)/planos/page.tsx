import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { SubscriptionPlan } from "@/lib/types";
import { createSubscriptionPlan } from "./actions";
import { PlanToggleButton } from "./PlanToggleButton";

export default async function PlanosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("stripe_connect_onboarded")
    .eq("id", user!.id)
    .single();

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<SubscriptionPlan[]>();

  if (!nutritionist?.stripe_connect_onboarded) {
    return (
      <div>
        <h1 className="mb-2 text-2xl font-bold">Planos de acompanhamento</h1>
        <p className="rounded-xl border border-warning bg-warning-soft p-4 text-sm text-warning">
          Conecte sua conta Stripe antes de criar planos.{" "}
          <Link href="/configuracoes" className="font-bold underline">
            Ir para Configurações
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Planos de acompanhamento</h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        Planos que seus pacientes assinam com cobrança recorrente direto na sua conta Stripe.
      </p>

      <form
        action={createSubscriptionPlan}
        className="mb-8 grid grid-cols-1 gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 sm:grid-cols-2"
      >
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">Nome do plano</span>
          <input name="name" required placeholder="Acompanhamento mensal" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm" />
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">Descrição</span>
          <input name="description" placeholder="Consulta mensal + revisão de protocolo + suporte via app" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">Preço (R$)</span>
          <input name="price_reais" type="number" step="0.01" min="1" required className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">Cobrança</span>
          <select name="interval" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
            <option value="month">Mensal</option>
            <option value="quarter">Trimestral</option>
          </select>
        </label>
        <div className="sm:col-span-2">
          <Button type="submit">Criar plano</Button>
        </div>
      </form>

      <div className="flex flex-col gap-3">
        {plans?.length ? (
          plans.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <div>
                <div className="flex items-center gap-2">
                  <b className="text-sm">{p.name}</b>
                  <Badge tone={p.active ? "success" : "neutral"}>{p.active ? "ativo" : "inativo"}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{p.description}</p>
                <p className="mt-1 font-mono-data text-sm font-bold text-brand">
                  R$ {(p.price_cents / 100).toFixed(2)} / {p.interval === "month" ? "mês" : "trimestre"}
                </p>
              </div>
              <PlanToggleButton planId={p.id} active={p.active} />
            </div>
          ))
        ) : (
          <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--ink-soft)]">
            Nenhum plano criado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
