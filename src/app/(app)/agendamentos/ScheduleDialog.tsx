"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { Patient } from "@/lib/types";
import { createPatientAndSchedule } from "./actions";
import { scheduleAppointment } from "../pacientes/[id]/appointment-actions";

export function ScheduleDialog({ patients }: { patients: Patient[] }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existente" | "novo">("existente");
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Novo agendamento</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold">Novo agendamento</h2>

            <div className="mb-4 flex gap-2">
              <button
                type="button"
                onClick={() => setMode("existente")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  mode === "existente" ? "border-brand bg-brand text-brand-on" : "border-[var(--border)] text-[var(--ink-soft)]"
                }`}
              >
                Paciente já cadastrado
              </button>
              <button
                type="button"
                onClick={() => setMode("novo")}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  mode === "novo" ? "border-brand bg-brand text-brand-on" : "border-[var(--border)] text-[var(--ink-soft)]"
                }`}
              >
                Cadastrar novo paciente
              </button>
            </div>

            <form
              ref={formRef}
              action={async (formData) => {
                setError(null);
                try {
                  if (mode === "existente") {
                    if (!selectedPatientId) throw new Error("Selecione um paciente.");
                    await scheduleAppointment(selectedPatientId, formData);
                  } else {
                    await createPatientAndSchedule(formData);
                  }
                  setOpen(false);
                  formRef.current?.reset();
                  setSelectedPatientId("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erro ao agendar.");
                }
              }}
            >
              {mode === "existente" ? (
                <label className="mb-3 block">
                  <FieldLabel>Paciente</FieldLabel>
                  <select
                    value={selectedPatientId}
                    onChange={(e) => setSelectedPatientId(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                  >
                    <option value="">Selecione…</option>
                    {patients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <div className="mb-3 grid grid-cols-2 gap-3">
                  <Field label="Nome completo" name="full_name" required className="col-span-2" />
                  <Field label="Nascimento" name="birth_date" type="date" required />
                  <div>
                    <FieldLabel>Sexo</FieldLabel>
                    <select name="sex" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
                      <option value="feminino">Feminino</option>
                      <option value="masculino">Masculino</option>
                      <option value="outro">Outro</option>
                    </select>
                  </div>
                  <Field label="Telefone" name="phone" />
                  <Field label="E-mail" name="email" type="email" />
                </div>
              )}

              <div className="mb-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <FieldLabel>Data e horário</FieldLabel>
                  <input
                    name="scheduled_at"
                    type="datetime-local"
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                  />
                </label>
                <Field label="Observações" name="notes" />
              </div>

              {mode === "novo" && (
                <p className="mb-3 text-[11px] text-[var(--ink-soft)]">
                  Como é a primeira consulta, uma ficha de anamnese pendente será enviada automaticamente ao portal do paciente.
                </p>
              )}

              {error && <p className="mb-3 text-xs text-danger">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Agendar</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  className = "",
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <FieldLabel>{label}</FieldLabel>
      <input
        name={name}
        type={type}
        required={required}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
