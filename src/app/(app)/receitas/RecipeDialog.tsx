"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createRecipe } from "./actions";

type Row = { id: number; name: string; quantity: string };

let counter = 0;
function newRow(): Row {
  counter += 1;
  return { id: counter, name: "", quantity: "" };
}

export function RecipeDialog() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([newRow(), newRow()]);
  const formRef = useRef<HTMLFormElement>(null);

  function close() {
    setOpen(false);
    setRows([newRow(), newRow()]);
    formRef.current?.reset();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Nova receita</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <form
            ref={formRef}
            onClick={(e) => e.stopPropagation()}
            action={async (formData) => {
              await createRecipe(formData);
              close();
            }}
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"
          >
            <h2 className="mb-4 text-lg font-bold">Nova receita</h2>

            <div className="mb-3 grid grid-cols-3 gap-3">
              <Field label="Nome" name="name" required className="col-span-2" />
              <Field label="Preparo (min)" name="prep_time_min" type="number" />
            </div>
            <Field label="Descrição curta" name="description" className="mb-4" />

            <FieldLabel>Ingredientes</FieldLabel>
            <div className="mb-2 flex flex-col gap-2">
              {rows.map((row) => (
                <div key={row.id} className="flex gap-1.5">
                  <input
                    name="ingredient_name"
                    value={row.name}
                    onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: e.target.value } : r)))}
                    placeholder="Ingrediente"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    name="ingredient_quantity"
                    value={row.quantity}
                    onChange={(e) => setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, quantity: e.target.value } : r)))}
                    placeholder="2 col. sopa"
                    className="w-28 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== row.id) : prev))}
                    className="px-2 text-xs text-danger"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => setRows((prev) => [...prev, newRow()])} className="mb-4 text-xs font-semibold text-brand">
              + adicionar ingrediente
            </button>

            <label className="mb-5 block">
              <FieldLabel>Modo de preparo</FieldLabel>
              <textarea
                name="instructions"
                required
                rows={6}
                placeholder="Passo a passo que o paciente vai ler no app…"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
              />
            </label>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit">Salvar receita</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">{children}</span>
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
