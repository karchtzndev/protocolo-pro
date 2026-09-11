import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import type { Patient } from "@/lib/types";
import { NewPatientDialog } from "./NewPatientDialog";

const statusTone = { ativo: "success", pendente: "warning", inativo: "neutral" } as const;

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { q, status } = await searchParams;
  const supabase = await createClient();

  let query = supabase.from("patients").select("*").order("created_at", { ascending: false });
  if (q) query = query.ilike("full_name", `%${q}%`);
  if (status) query = query.eq("status", status);

  const { data: patients } = await query.returns<Patient[]>();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{patients?.length ?? 0} pacientes cadastrados</p>
        </div>
        <NewPatientDialog />
      </div>

      <form className="mb-4 flex flex-wrap items-center gap-2.5">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nome..."
          className="min-w-[180px] flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-brand"
        />
        {["", "ativo", "pendente", "inativo"].map((s) => (
          <Link
            key={s || "todos"}
            href={`/pacientes${s ? `?status=${s}` : ""}`}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              (status ?? "") === s
                ? "border-brand bg-brand text-brand-on"
                : "border-[var(--border)] text-[var(--ink-soft)]"
            }`}
          >
            {s ? s[0].toUpperCase() + s.slice(1) : "Todos"}
          </Link>
        ))}
      </form>

      <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-sm">
        {patients?.length ? (
          patients.map((p) => (
            <Link
              key={p.id}
              href={`/pacientes/${p.id}`}
              className="flex items-center gap-3.5 rounded-lg p-3.5 hover:bg-[var(--surface-2)]"
            >
              <div className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg bg-accent-soft font-display text-[13px] font-bold text-accent-strong">
                {initials(p.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px]">{p.full_name}</b>
                <span className="block truncate text-xs text-[var(--ink-soft)]">{p.objective ?? "—"}</span>
              </div>
              <Badge tone={statusTone[p.status]}>{p.status}</Badge>
            </Link>
          ))
        ) : (
          <p className="p-6 text-center text-sm text-[var(--ink-soft)]">
            Nenhum paciente encontrado. Cadastre o primeiro paciente para começar.
          </p>
        )}
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
