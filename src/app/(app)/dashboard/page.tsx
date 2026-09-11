import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui/Card";
import type { AuditLogEntry } from "@/lib/types";

const ACTION_LABELS: Record<string, string> = {
  "paciente.arquivar": "Paciente arquivado",
  "antropometria.registrar": "Aferição registrada",
  "plano.criar": "Protocolo salvo (rascunho)",
  "protocolo.publicar": "Protocolo publicado",
  "protocolo.revogar_link": "Link do paciente revogado",
  "exame.enviar": "Exame enviado para análise",
  "exame.confirmar": "Marcador de exame confirmado",
  "suplementacao.salvar": "Suplementação prescrita",
  "suplementacao.assinar": "Prescrição assinada",
  "perfil.atualizar": "Perfil atualizado",
  "dados.exportar": "Dados exportados (LGPD)",
  "conta.solicitar_exclusao": "Exclusão de conta solicitada",
};

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: totalPatients }, { count: activeProtocols }, { count: pendingExams }, { data: nutritionist }, { data: recentActivity }] =
    await Promise.all([
      supabase.from("patients").select("*", { count: "exact", head: true }),
      supabase.from("protocols").select("*", { count: "exact", head: true }).eq("active", true),
      supabase.from("exams").select("*", { count: "exact", head: true }).eq("status", "processando"),
      supabase.from("nutritionists").select("full_name, plan, subscription_status").eq("id", user!.id).single(),
      supabase
        .from("audit_log")
        .select("*")
        .eq("nutritionist_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(5)
        .returns<AuditLogEntry[]>(),
    ]);

  const firstName = nutritionist?.full_name?.split(" ")[0] ?? "";
  const today = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date());

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Olá, {firstName} 👋</h1>
          <p className="mt-1 text-sm capitalize text-[var(--ink-soft)]">{today}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
        <StatCard label="Total de pacientes" value={totalPatients ?? 0} />
        <StatCard label="Protocolos ativos" value={activeProtocols ?? 0} />
        <StatCard label="Exames p/ revisar" value={pendingExams ?? 0} warn={(pendingExams ?? 0) > 0} />
        <StatCard label="Plano" value={nutritionist?.plan === "clinica" ? "Clínica" : "Solo"} isText />
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-5 py-3.5">
          <h3 className="text-sm font-semibold">Últimas ações</h3>
        </div>
        <ul className="px-5 pb-2">
          {recentActivity?.length ? (
            recentActivity.map((entry) => (
              <ActivityRow
                key={entry.id}
                text={ACTION_LABELS[entry.action_type] ?? entry.action_type}
                time={relativeTime(entry.created_at)}
              />
            ))
          ) : (
            <li className="py-3 text-sm text-[var(--ink-soft)]">Nenhuma ação registrada ainda.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  isText,
  warn,
}: {
  label: string;
  value: string | number;
  isText?: boolean;
  warn?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-xs font-semibold text-[var(--ink-soft)]">{label}</div>
      <div className={`mt-2 font-display font-bold ${isText ? "text-lg" : "font-mono-data text-2xl"}`}>{value}</div>
      {warn && <div className="mt-1 text-[11.5px] font-semibold text-warning">▲ requer atenção</div>}
    </Card>
  );
}

function relativeTime(isoDate: string) {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours}h`;
  const days = Math.floor(hours / 24);
  return `há ${days}d`;
}

function ActivityRow({ text, time }: { text: string; time: string }) {
  return (
    <li className="flex justify-between gap-3 border-b border-dashed border-[var(--border-soft)] py-2.5 text-sm last:border-none">
      <span>{text}</span>
      <span className="whitespace-nowrap font-mono-data text-[11.5px] text-[var(--ink-faint)]">{time}</span>
    </li>
  );
}
