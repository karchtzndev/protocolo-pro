import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Patient, PatientLink } from "@/lib/types";
import { createLink, revokeLink } from "./actions";
import { CopyLinkButton } from "./CopyLinkButton";

export default async function LinksPage() {
  const supabase = await createClient();

  const [{ data: links }, { data: patients }] = await Promise.all([
    supabase
      .from("patient_links")
      .select("*, patient:patients(full_name)")
      .order("created_at", { ascending: false })
      .returns<(PatientLink & { patient: Pick<Patient, "full_name"> })[]>(),
    supabase.from("patients").select("id, full_name").order("full_name").returns<Pick<Patient, "id" | "full_name">[]>(),
  ]);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">Links de pacientes</h1>
      <p className="mb-6 text-sm text-[var(--ink-soft)]">Acesso público sem necessidade de login.</p>

      <form action={createLink} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
        <label className="flex-1 min-w-[180px]">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Paciente
          </span>
          <select name="patient_id" required className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
            {patients?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Expira em (dias)
          </span>
          <input
            type="number"
            name="expires_in_days"
            defaultValue={90}
            className="w-28 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
        </label>
        <Button type="submit">Gerar link</Button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <Th>Paciente</Th>
              <Th>Link</Th>
              <Th>Expira em</Th>
              <Th>Status</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {links?.map((link) => {
              const revoked = !!link.revoked_at;
              const expired = link.expires_at ? new Date(link.expires_at) < new Date() : false;
              const url = `${process.env.NEXT_PUBLIC_APP_URL}/p/${link.slug}`;
              return (
                <tr key={link.id}>
                  <Td>{link.patient.full_name}</Td>
                  <Td>
                    <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 font-mono-data text-xs">
                      protocolo.pro/p/{link.slug}
                    </code>
                  </Td>
                  <Td>{link.expires_at ? new Date(link.expires_at).toLocaleDateString("pt-BR") : "—"}</Td>
                  <Td>
                    <Badge tone={revoked || expired ? "neutral" : "success"}>
                      {revoked ? "revogado" : expired ? "expirado" : "ativo"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex gap-1.5">
                      <CopyLinkButton url={url} />
                      {!revoked && (
                        <form action={revokeLink}>
                          <input type="hidden" name="link_id" value={link.id} />
                          <Button type="submit" variant="danger-ghost" size="sm">
                            Revogar
                          </Button>
                        </form>
                      )}
                    </div>
                  </Td>
                </tr>
              );
            })}
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
