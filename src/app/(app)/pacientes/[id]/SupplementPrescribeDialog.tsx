"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { SupplementCatalogItem, SupplementPreset } from "@/lib/types";
import { prescribeSupplement, applySupplementPreset } from "./supplement-actions";

export function SupplementPrescribeDialog({
  patientId,
  catalog,
  presets,
}: {
  patientId: string;
  catalog: SupplementCatalogItem[];
  presets: SupplementPreset[];
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [dose, setDose] = useState("");
  const [doseUnit, setDoseUnit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const selected = catalog.find((c) => c.id === selectedId);
  const overUl = !!(selected?.max_daily_dose && Number(dose) > selected.max_daily_dose);

  function selectSupplement(id: string) {
    setSelectedId(id);
    const item = catalog.find((c) => c.id === id);
    setDose(item?.default_dose != null ? String(item.default_dose) : "");
    setDoseUnit(item?.dose_unit ?? "");
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Prescrever suplemento</Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold">Prescrever suplementação</h2>

            {presets.length > 0 && (
              <div className="mb-5">
                <FieldLabel>Aplicar protocolo pré-montado</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {presets.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={async () => {
                        await applySupplementPreset(patientId, preset.id);
                        setOpen(false);
                      }}
                      className="rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold hover:border-brand"
                    >
                      {preset.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <FieldLabel>Ou prescrever individualmente</FieldLabel>
            <form
              ref={formRef}
              action={async (formData) => {
                setError(null);
                try {
                  await prescribeSupplement(patientId, formData);
                  setOpen(false);
                  formRef.current?.reset();
                  setDose("");
                  setDoseUnit("");
                  setSelectedId("");
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Erro ao prescrever.");
                }
              }}
            >
              <label className="mb-3 block">
                <FieldLabel>Suplemento</FieldLabel>
                <select
                  name="supplement_id"
                  value={selectedId}
                  onChange={(e) => selectSupplement(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                >
                  <option value="">Selecione…</option>
                  {catalog.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.requires_fitoterapia_license ? "(requer habilitação fitoterapia)" : ""}
                    </option>
                  ))}
                </select>
                {selected?.default_dose != null && (
                  <p className="mt-1 text-[11px] text-[var(--ink-soft)]">
                    Dose e unidade pré-preenchidas com o padrão usual ({selected.default_dose} {selected.dose_unit}) — ajuste conforme o caso.
                  </p>
                )}
              </label>

              <div className="mb-3 grid grid-cols-2 gap-3">
                <label className="block">
                  <FieldLabel>Dose</FieldLabel>
                  <input
                    name="dose"
                    type="number"
                    step="0.1"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                  />
                </label>
                <label className="block">
                  <FieldLabel>Unidade</FieldLabel>
                  <input
                    name="dose_unit"
                    value={doseUnit}
                    onChange={(e) => setDoseUnit(e.target.value)}
                    required
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <label className="mb-3 block">
                <FieldLabel>Horário / esquema</FieldLabel>
                <input
                  name="schedule"
                  placeholder="ex: 1x ao dia, pela manhã"
                  required
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
                />
              </label>

              {overUl && (
                <label className="mb-3 block">
                  <FieldLabel>
                    Justificativa (obrigatória — dose acima do UL de {selected?.max_daily_dose} {selected?.dose_unit}/dia)
                  </FieldLabel>
                  <textarea
                    name="justification"
                    rows={2}
                    required
                    className="w-full rounded-lg border border-warning bg-[var(--surface-2)] px-3 py-2 text-sm"
                  />
                </label>
              )}

              {error && <p className="mb-3 text-xs text-danger">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Prescrever</Button>
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
