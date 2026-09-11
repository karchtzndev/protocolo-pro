"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createPatient } from "./actions";

export function NewPatientDialog() {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Novo paciente</Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            ref={formRef}
            onClick={(e) => e.stopPropagation()}
            action={async (formData) => {
              await createPatient(formData);
              setOpen(false);
              formRef.current?.reset();
            }}
            className="w-full max-w-md rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"
          >
            <h2 className="mb-4 text-lg font-bold">Novo paciente</h2>

            <div className="mb-3 grid grid-cols-2 gap-3">
              <Field label="Nome completo" name="full_name" required className="col-span-2" />
              <Field label="Nascimento" name="birth_date" type="date" required />
              <div>
                <FieldLabel>Sexo</FieldLabel>
                <select
                  name="sex"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                >
                  <option value="feminino">Feminino</option>
                  <option value="masculino">Masculino</option>
                  <option value="outro">Outro</option>
                </select>
              </div>
              <Field label="Telefone" name="phone" />
              <Field label="E-mail" name="email" type="email" />
            </div>
            <Field label="Objetivo" name="objective" className="mb-5" />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Cadastrar paciente</Button>
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
