import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import type { Nutritionist, AccountDeletionRequest, AuditLogEntry } from "@/lib/types";
import { updateProfile, updateBrand } from "./actions";
import { BillingButtons } from "./BillingButtons";
import { ConnectStripeButton } from "./ConnectStripeButton";
import { LgpdSection } from "./LgpdSection";
import { LogoUpload } from "./LogoUpload";
import { meetsWcagAA } from "@/lib/colorContrast";
import { syncConnectStatus } from "./connectSync";

const ACTION_LABELS: Record<string, string> = {
  "paciente.arquivar": "Paciente arquivado",
  "antropometria.registrar": "Aferição registrada",
  "plano.criar": "Protocolo salvo (rascunho)",
  "protocolo.publicar": "Protocolo publicado",
  "protocolo.revogar_link": "Link do paciente revogado",
  "exame.enviar": "Exame enviado",
  "exame.confirmar": "Marcador de exame confirmado",
  "suplementacao.salvar": "Suplementação prescrita",
  "suplementacao.assinar": "Prescrição assinada",
  "perfil.atualizar": "Perfil atualizado",
  "dados.exportar": "Dados exportados (LGPD)",
  "conta.solicitar_exclusao": "Exclusão de conta solicitada",
};

export default async function ConfiguracoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: n } = await supabase.from("nutritionists").select("*").eq("id", user!.id).single<Nutritionist>();

  if (!n) return null;

  if (n.stripe_connect_account_id && !n.stripe_connect_onboarded) {
    const onboarded = await syncConnectStatus(n.id, n.stripe_connect_account_id);
    n.stripe_connect_onboarded = onboarded;
  }

  const [{ data: pendingDeletion }, { data: auditLog }] = await Promise.all([
    supabase
      .from("account_deletion_requests")
      .select("*")
      .eq("nutritionist_id", user!.id)
      .eq("status", "pendente")
      .maybeSingle<AccountDeletionRequest>(),
    supabase
      .from("audit_log")
      .select("*")
      .eq("nutritionist_id", user!.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .returns<AuditLogEntry[]>(),
  ]);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Configurações</h1>

      <Section title="Perfil">
        <form action={updateProfile} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Nome completo" name="full_name" defaultValue={n.full_name} />
          <Field label="Registro profissional (CRN)" name="crn" defaultValue={n.crn} />
          <SubmitRow />
        </form>
      </Section>

      <Section title="Marca da clínica">
        <div className="mb-4">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Logo
          </span>
          <LogoUpload nutritionistId={n.id} currentLogoUrl={n.logo_url} />
        </div>
        <form action={updateBrand} className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          <Field label="Nome exibido ao paciente" name="clinic_name" defaultValue={n.clinic_name ?? ""} />
          <Field label="Contato exibido no PDF" name="clinic_phone" defaultValue={n.clinic_phone ?? ""} />
          <ColorField label="Cor primária" name="brand_primary_color" defaultValue={n.brand_primary_color} />
          <ColorField label="Cor de destaque" name="brand_accent_color" defaultValue={n.brand_accent_color} />
          <SubmitRow />
        </form>
      </Section>

      <Section title="Assinatura — Stripe">
        <div className="flex items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <span>💳</span>
          <span className="text-[var(--ink-soft)]">Plano {n.plan === "clinica" ? "Clínica" : "Solo"}</span>
          <Badge tone={n.subscription_status === "active" ? "success" : "warning"}>{n.subscription_status}</Badge>
        </div>
        <BillingButtons hasSubscription={!!n.stripe_subscription_id} currentPlan={n.plan} />
      </Section>

      <Section title="Faturamento de pacientes">
        <p className="mb-3 text-sm text-[var(--ink-soft)]">
          Conecte sua própria conta Stripe para vender planos de acompanhamento recorrentes aos seus pacientes. O
          dinheiro cai direto na sua conta — o Protocolo.Pro nunca fica no meio.
        </p>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-sm">
          <span>🏦</span>
          <span className="text-[var(--ink-soft)]">
            {n.stripe_connect_onboarded
              ? "Conta Stripe conectada"
              : n.stripe_connect_account_id
                ? "Onboarding iniciado, mas incompleto"
                : "Nenhuma conta conectada"}
          </span>
          <Badge tone={n.stripe_connect_onboarded ? "success" : "warning"}>
            {n.stripe_connect_onboarded ? "ativo" : "pendente"}
          </Badge>
          <div className="ml-auto flex gap-2">
            {!n.stripe_connect_onboarded && <ConnectStripeButton label={n.stripe_connect_account_id ? "Concluir conexão" : "Conectar Stripe"} />}
            {n.stripe_connect_onboarded && (
              <Link href="/planos" className="text-xs font-bold text-brand underline">
                Gerenciar planos de acompanhamento →
              </Link>
            )}
          </div>
        </div>
      </Section>

      <Section title="Documentos legais">
        <p className="mb-2 text-sm text-[var(--ink-soft)]">
          Termo de consentimento:{" "}
          <b>{n.consent_document_url ? "documento próprio enviado" : "modelo padrão Protocolo.Pro"}</b>
        </p>
        <p className="text-sm text-[var(--ink-soft)]">
          Política de privacidade: <b>{n.privacy_document_url ? "documento próprio enviado" : "modelo padrão"}</b>
        </p>
      </Section>

      <Section title="LGPD">
        <LgpdSection pendingRequest={pendingDeletion ?? null} />
      </Section>

      <Section title="Auditoria">
        {auditLog?.length ? (
          <div className="overflow-hidden rounded-lg border border-[var(--border-soft)]">
            <table className="w-full text-xs">
              <tbody>
                {auditLog.map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--border-soft)] last:border-none">
                    <td className="px-3 py-2 font-semibold">{ACTION_LABELS[entry.action_type] ?? entry.action_type}</td>
                    <td className="px-3 py-2 text-[var(--ink-soft)]">{new Date(entry.created_at).toLocaleString("pt-BR")}</td>
                    <td className="px-3 py-2 font-mono-data text-[var(--ink-faint)]">{entry.ip_truncated ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">Nenhuma ação registrada ainda.</p>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}

function ColorField({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  const okContrast = meetsWcagAA(defaultValue);
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input type="color" name={name} defaultValue={defaultValue} className="h-9 w-12 rounded border border-[var(--border)]" />
        <span className="font-mono-data text-xs text-[var(--ink-soft)]">{defaultValue}</span>
        {!okContrast && (
          <span className="text-[11px] font-semibold text-warning">⚠ contraste baixo em fundo branco</span>
        )}
      </div>
    </label>
  );
}

function SubmitRow() {
  return (
    <div className="col-span-full">
      <button className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-on hover:brightness-110">
        Salvar alterações
      </button>
    </div>
  );
}
