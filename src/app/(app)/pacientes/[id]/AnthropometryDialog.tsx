"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ACTIVITY_LEVEL_LABELS, type ActivityLevel } from "@/lib/health/energyEquations";
import { saveAnthropometry } from "./anthropometry-actions";

export function AnthropometryDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Nova aferição</Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            ref={formRef}
            onClick={(e) => e.stopPropagation()}
            action={async (formData) => {
              await saveAnthropometry(patientId, formData);
              setOpen(false);
              formRef.current?.reset();
            }}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"
          >
            <h2 className="mb-4 text-lg font-bold">Nova aferição</h2>

            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Peso (kg)" name="weight_kg" required />
              <Field label="Altura (m)" name="height_m" step="0.01" placeholder="ex: 1,75" required />
              <div>
                <FieldLabel>Nível de atividade</FieldLabel>
                <select
                  name="activity_level"
                  defaultValue="moderado"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                >
                  {(Object.entries(ACTIVITY_LEVEL_LABELS) as [ActivityLevel, string][]).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              Opcional — desbloqueia Cunningham e Katch-McArdle
            </p>
            <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field label="Massa livre de gordura (kg)" name="lean_mass_kg" />
              <Field label="Pescoço (cm)" name="neck_cm" />
              <Field label="Cintura (cm)" name="waist_cm" />
              <Field label="Quadril (cm)" name="hip_cm" />
            </div>

            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              Dobras cutâneas (mm) — opcional, conforme os protocolos que quiser calcular
            </p>
            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Peitoral" name="skinfold_chest_mm" />
              <Field label="Axilar média" name="skinfold_midaxillary_mm" />
              <Field label="Tríceps" name="skinfold_triceps_mm" />
              <Field label="Subescapular" name="skinfold_subscapular_mm" />
              <Field label="Abdominal" name="skinfold_abdominal_mm" />
              <Field label="Suprailíaca" name="skinfold_suprailiac_mm" />
              <Field label="Coxa" name="skinfold_thigh_mm" />
              <Field label="Bíceps" name="skinfold_bicep_mm" />
            </div>

            <label className="mb-5 block">
              <FieldLabel>Observações</FieldLabel>
              <textarea
                name="notes"
                rows={2}
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar aferição</Button>
            </div>
          </form>
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
  step,
  placeholder,
  required,
}: {
  label: string;
  name: string;
  step?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        name={name}
        type="number"
        step={step ?? "0.1"}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
