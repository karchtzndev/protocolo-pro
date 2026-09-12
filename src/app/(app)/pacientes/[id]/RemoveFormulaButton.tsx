"use client";

import { removeCompoundedFormula } from "./formula-actions";

export function RemoveFormulaButton({ patientId, formulaId }: { patientId: string; formulaId: string }) {
  return (
    <button
      type="button"
      title="Remover"
      onClick={async () => {
        if (!confirm("Remover esta fórmula manipulada?")) return;
        await removeCompoundedFormula(patientId, formulaId);
      }}
      className="rounded-md px-1.5 py-0.5 text-xs text-[var(--ink-faint)] hover:bg-danger-soft hover:text-danger"
    >
      ✕
    </button>
  );
}
