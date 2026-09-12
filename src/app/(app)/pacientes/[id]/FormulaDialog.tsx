"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { createCompoundedFormula } from "./formula-actions";

type Row = { id: number; name: string; dose: string; unit: string };

let rowCounter = 0;
function newRow(): Row {
  rowCounter += 1;
  return { id: rowCounter, name: "", dose: "", unit: "mg" };
}

export function FormulaDialog({ patientId }: { patientId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([newRow(), newRow()]);
  const formRef = useRef<HTMLFormElement>(null);

  function updateRow(id: number, field: keyof Row, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  }

  function close() {
    setOpen(false);
    setRows([newRow(), newRow()]);
    formRef.current?.reset();
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        + Nova fórmula manipulada
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={close}>
          <form
            ref={formRef}
            onClick={(e) => e.stopPropagation()}
            action={async (formData) => {
              await createCompoundedFormula(patientId, formData);
              close();
            }}
            className="w-full max-w-lg rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"
          >
            <h2 className="mb-4 text-lg font-bold">Nova fórmula manipulada</h2>

            <label className="mb-4 block">
              <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                Nome da fórmula
              </span>
              <input
                name="name"
                required
                placeholder="Ex.: Cápsula de suporte imunológico"
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
              />
            </label>

            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              Ingredientes
            </span>
            <div className="mb-2 flex flex-col gap-2">
              {rows.map((row) => (
                <div key={row.id} className="flex gap-1.5">
                  <input
                    name="ingredient_name"
                    value={row.name}
                    onChange={(e) => updateRow(row.id, "name", e.target.value)}
                    placeholder="Substância (ex.: sulfato ferroso)"
                    className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs"
                  />
                  <input
                    name="ingredient_dose"
                    value={row.dose}
                    onChange={(e) => updateRow(row.id, "dose", e.target.value)}
                    type="number"
                    step="0.01"
                    placeholder="Dose"
                    className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-xs"
                  />
                  <select
                    name="ingredient_unit"
                    value={row.unit}
                    onChange={(e) => updateRow(row.id, "unit", e.target.value)}
                    className="w-20 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs"
                  >
                    <option value="mg">mg</option>
                    <option value="mcg">mcg</option>
                    <option value="g">g</option>
                    <option value="UI">UI</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((r) => r.id !== row.id) : prev))}
                    className="rounded-lg px-2 text-xs text-danger"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRows((prev) => [...prev, newRow()])}
              className="mb-5 text-xs font-semibold text-brand"
            >
              + adicionar ingrediente
            </button>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button type="submit">Salvar fórmula</Button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
