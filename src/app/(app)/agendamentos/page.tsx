import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import type { Appointment, Patient } from "@/lib/types";
import { ScheduleDialog } from "./ScheduleDialog";

const STATUS_TONE = { agendado: "neutral", concluido: "success", cancelado: "danger" } as const;

export default async function AgendamentosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: appointments }, { data: patients }] = await Promise.all([
    supabase
      .from("appointments")
      .select("*, patient:patients(full_name)")
      .eq("nutritionist_id", user!.id)
      .order("scheduled_at", { ascending: false })
      .returns<(Appointment & { patient: { full_name: string } })[]>(),
    supabase.from("patients").select("*").eq("status", "ativo").order("full_name").returns<Patient[]>(),
  ]);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Agendamentos</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">{appointments?.length ?? 0} consultas registradas</p>
        </div>
        <ScheduleDialog patients={patients ?? []} />
      </div>

      {!appointments?.length ? (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--ink-soft)]">
          Nenhuma consulta agendada ainda.
        </p>
      ) : (
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-1.5 shadow-sm">
          {appointments.map((a) => (
            <Link
              key={a.id}
              href={`/pacientes/${a.patient_id}`}
              className="flex items-center justify-between gap-3.5 rounded-lg p-3.5 hover:bg-[var(--surface-2)]"
            >
              <div className="min-w-0 flex-1">
                <b className="block truncate text-[13.5px]">{a.patient?.full_name}</b>
                <span className="block truncate text-xs text-[var(--ink-soft)]">
                  {new Date(a.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
