"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Appointment, AnamnesisResponse } from "@/lib/types";
import { scheduleAppointment, cancelAppointment, completeAppointment } from "./appointment-actions";

const STATUS_TONE = { agendado: "neutral", concluido: "success", cancelado: "danger" } as const;

const ANAMNESIS_FIELD_LABELS: Record<string, string> = {
  habitos_alimentares: "Hábitos alimentares",
  historico_familiar: "Histórico familiar",
  atividade_fisica: "Atividade física",
  qualidade_sono: "Qualidade do sono",
  uso_medicamentos: "Uso de medicamentos",
  alergias_intolerancias: "Alergias e intolerâncias",
  tabagismo_alcool: "Tabagismo / álcool",
  observacoes: "Observações",
};

export function AgendamentosTab({
  patientId,
  appointments,
  anamnesisByAppointment,
}: {
  patientId: string;
  appointments: Appointment[];
  anamnesisByAppointment: Record<string, AnamnesisResponse>;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <form
        ref={formRef}
        action={async (formData) => {
          setError(null);
          try {
            await scheduleAppointment(patientId, formData);
            formRef.current?.reset();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erro ao agendar.");
          }
        }}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4"
      >
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Data e horário
          </span>
          <input
            name="scheduled_at"
            type="datetime-local"
            required
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
        </label>
        <label className="block flex-1 min-w-[180px]">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Observações
          </span>
          <input
            name="notes"
            placeholder="opcional"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
          />
        </label>
        <Button type="submit">Agendar consulta</Button>
        {error && <p className="w-full text-xs text-danger">{error}</p>}
      </form>

      <p className="mb-4 text-xs text-[var(--ink-soft)]">
        Na primeira consulta do paciente, uma ficha de anamnese pendente é enviada automaticamente para o portal dele
        (o mesmo link <code>/p/…</code> que ele já usa para ver o protocolo). Nas consultas seguintes isso não se repete.
      </p>

      {!appointments.length ? (
        <p className="text-center text-sm text-[var(--ink-soft)]">Nenhuma consulta agendada ainda.</p>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => {
            const anamnesis = anamnesisByAppointment[a.id];
            return (
              <div key={a.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <b className="text-sm">
                    {new Date(a.scheduled_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                  </b>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
                    {a.status === "agendado" && (
                      <>
                        <button
                          type="button"
                          onClick={async () => {
                            await completeAppointment(patientId, a.id);
                            router.refresh();
                          }}
                          className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-success hover:bg-success-soft"
                        >
                          concluir
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!confirm("Cancelar esta consulta?")) return;
                            await cancelAppointment(patientId, a.id);
                            router.refresh();
                          }}
                          className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-danger hover:bg-danger-soft"
                        >
                          cancelar
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {a.notes && <p className="mb-2 text-xs text-[var(--ink-soft)]">{a.notes}</p>}

                {anamnesis && (
                  <div className="mt-2 rounded-lg border border-dashed border-[var(--border-soft)] p-3">
                    <div className="mb-1.5 flex items-center justify-between">
                      <span className="text-xs font-semibold">Anamnese</span>
                      <Badge tone={anamnesis.status === "preenchido" ? "success" : "warning"}>
                        {anamnesis.status === "preenchido" ? "preenchida" : "aguardando paciente"}
                      </Badge>
                    </div>
                    {anamnesis.status === "preenchido" && (
                      <div className="space-y-1 text-xs text-[var(--ink-soft)]">
                        {Object.entries(anamnesis.responses).map(([key, value]) =>
                          value ? (
                            <p key={key}>
                              <b>{ANAMNESIS_FIELD_LABELS[key] ?? key}:</b> {value}
                            </p>
                          ) : null
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
