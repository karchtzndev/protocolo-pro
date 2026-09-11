"use client";

import { removeSupplement } from "./supplement-actions";

export function RemoveSupplementButton({ patientId, supplementRowId }: { patientId: string; supplementRowId: string }) {
  return (
    <button
      type="button"
      title="Remover"
      onClick={async () => {
        if (!confirm("Remover este suplemento prescrito?")) return;
        await removeSupplement(patientId, supplementRowId);
      }}
      className="rounded-md px-1.5 py-0.5 text-xs text-[var(--ink-faint)] hover:bg-danger-soft hover:text-danger"
    >
      ✕
    </button>
  );
}
