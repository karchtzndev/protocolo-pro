import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/Button";
import type { Broadcast, Patient } from "@/lib/types";
import { sendBroadcast } from "./actions";

export default async function BroadcastPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: broadcasts }, { data: allPatients }] = await Promise.all([
    supabase.from("broadcasts").select("*").order("sent_at", { ascending: false }).returns<Broadcast[]>(),
    supabase.from("patients").select("*").neq("status", "inativo").returns<Patient[]>(),
  ]);

  const allTags = Array.from(new Set((allPatients ?? []).flatMap((p) => p.tags))).sort();

  const justSent = sent ? broadcasts?.find((b) => b.id === sent) : null;
  const justSentEmails = justSent
    ? (allPatients ?? [])
        .filter((p) => !justSent.filter_tags.length || p.tags.some((t) => justSent.filter_tags.includes(t)))
        .map((p) => p.email)
        .filter((e): e is string => !!e)
    : [];

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Broadcast</h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">
        Envie comunicados em lote para pacientes filtrados por tag (ex.: vip, indicação, gestante).
      </p>

      {justSent && (
        <div className="mb-6 rounded-xl border border-success bg-success-soft p-4">
          <p className="mb-2 text-sm font-semibold text-success">
            Comunicado &ldquo;{justSent.title}&rdquo; registrado para {justSent.recipient_count} paciente(s).
          </p>
          {justSentEmails.length > 0 ? (
            <a
              href={`mailto:?bcc=${encodeURIComponent(justSentEmails.join(","))}&subject=${encodeURIComponent(justSent.title)}&body=${encodeURIComponent(justSent.body)}`}
              className="text-xs font-bold underline"
            >
              Abrir no seu e-mail para {justSentEmails.length} destinatário(s) com e-mail cadastrado
            </a>
          ) : (
            <p className="text-xs text-[var(--ink-soft)]">Nenhum paciente do filtro tem e-mail cadastrado.</p>
          )}
        </div>
      )}

      <form action={sendBroadcast} className="mb-8 flex flex-col gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">Título</span>
          <input name="title" required className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">Mensagem</span>
          <textarea name="body" required rows={4} className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm" />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Tags (deixe vazio para todos os pacientes ativos)
          </span>
          <input
            name="tags"
            placeholder="vip, gestante, indicação"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
          {allTags.length > 0 && (
            <p className="mt-1.5 text-[11px] text-[var(--ink-faint)]">Tags em uso: {allTags.join(", ")}</p>
          )}
        </label>
        <Button type="submit" className="self-start">
          Preparar envio
        </Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Título</Th>
              <Th>Filtro</Th>
              <Th>Destinatários</Th>
              <Th>Data</Th>
            </tr>
          </thead>
          <tbody>
            {broadcasts?.map((b) => (
              <tr key={b.id}>
                <Td>{b.title}</Td>
                <Td>{b.filter_tags.length ? b.filter_tags.join(", ") : "todos"}</Td>
                <Td>{b.recipient_count}</Td>
                <Td>{new Date(b.sent_at).toLocaleDateString("pt-BR")}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return (
    <th className="border-b border-[var(--border-soft)] px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
      {children}
    </th>
  );
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="border-b border-[var(--border-soft)] px-3 py-3">{children}</td>;
}
