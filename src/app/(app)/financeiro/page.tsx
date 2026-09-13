import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import type { PatientSubscription, SubscriptionPlan } from "@/lib/types";

export default async function FinanceiroPage() {
  const supabase = await createClient();

  const [{ data: subscriptions }, { data: plans }] = await Promise.all([
    supabase
      .from("patient_subscriptions")
      .select("*, plan:subscription_plans(*), patient:patients(full_name)")
      .returns<(PatientSubscription & { patient: { full_name: string } })[]>(),
    supabase.from("subscription_plans").select("*").returns<SubscriptionPlan[]>(),
  ]);

  const all = subscriptions ?? [];
  const active = all.filter((s) => s.status === "active" || s.status === "trialing");
  const pastDue = all.filter((s) => s.status === "past_due");
  const canceled = all.filter((s) => s.status === "canceled");

  // MRR: normaliza planos trimestrais pra equivalente mensal antes de somar.
  const mrrCents = active.reduce((sum, s) => {
    const plan = s.plan;
    if (!plan) return sum;
    const monthly = plan.interval === "quarter" ? plan.price_cents / 3 : plan.price_cents;
    return sum + monthly;
  }, 0);

  const churnBase = active.length + canceled.length;
  const churnRate = churnBase > 0 ? Math.round((canceled.length / churnBase) * 100) : null;

  const byPlan = new Map<string, { plan: SubscriptionPlan; count: number }>();
  for (const s of active) {
    if (!s.plan) continue;
    const entry = byPlan.get(s.plan.id) ?? { plan: s.plan, count: 0 };
    entry.count += 1;
    byPlan.set(s.plan.id, entry);
  }
  const rankedPlans = Array.from(byPlan.values()).sort((a, b) => b.count - a.count);

  const avgTicketCents = active.length ? Math.round(mrrCents / active.length) : 0;
  // LTV simplificado: ticket médio ÷ taxa de churn mensal — sem churn medido, mostra "—" em vez de chutar.
  const ltvCents = churnRate && churnRate > 0 ? Math.round(avgTicketCents / (churnRate / 100)) : null;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Financeiro</h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        Receita recorrente dos planos de acompanhamento que seus pacientes assinam.
      </p>

      <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="MRR estimado" value={formatBRL(mrrCents)} />
        <StatCard label="Assinantes ativos" value={active.length} />
        <StatCard label="Ticket médio" value={formatBRL(avgTicketCents)} />
        <StatCard label="LTV estimado" value={ltvCents !== null ? formatBRL(ltvCents) : "—"} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3.5 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Planos mais vendidos</h3>
          {rankedPlans.length ? (
            <ul className="space-y-2">
              {rankedPlans.map(({ plan, count }) => (
                <li key={plan.id} className="flex items-center justify-between text-sm">
                  <span>{plan.name}</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono-data text-xs text-[var(--ink-soft)]">
                      {formatBRL(plan.price_cents)}/{plan.interval === "month" ? "mês" : "tri"}
                    </span>
                    <Badge tone="neutral">{count} assinante(s)</Badge>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[var(--ink-soft)]">Nenhum plano com assinante ativo ainda.</p>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold">Saúde da carteira</h3>
          <dl className="space-y-2 text-sm">
            <Row label="Em dia / em teste" value={active.length} tone="success" />
            <Row label="Pagamento pendente" value={pastDue.length} tone="warning" />
            <Row label="Cancelados (histórico)" value={canceled.length} tone="neutral" />
            <Row label="Taxa de cancelamento" value={churnRate !== null ? `${churnRate}%` : "sem dados ainda"} tone="neutral" />
          </dl>
        </Card>
      </div>

      <Card className="p-0">
        <div className="border-b border-[var(--border-soft)] px-4 py-3">
          <h3 className="text-sm font-semibold">Assinaturas com pagamento pendente</h3>
        </div>
        {pastDue.length ? (
          <div className="divide-y divide-[var(--border-soft)]">
            {pastDue.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span>{s.patient?.full_name}</span>
                <span className="text-xs text-[var(--ink-soft)]">{s.plan?.name}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-[var(--ink-soft)]">Nenhuma pendência no momento.</p>
        )}
      </Card>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-[var(--ink-soft)]">{label}</div>
      <div className="mt-2 font-mono-data text-2xl font-bold">{value}</div>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string | number; tone: "success" | "warning" | "neutral" }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-[var(--ink-soft)]">{label}</dt>
      <dd>
        <Badge tone={tone}>{value}</Badge>
      </dd>
    </div>
  );
}

function formatBRL(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
