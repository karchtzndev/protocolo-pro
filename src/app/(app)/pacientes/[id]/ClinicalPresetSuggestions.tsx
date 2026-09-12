"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupplementPreset } from "@/lib/types";
import { applySupplementPreset } from "./supplement-actions";

export function ClinicalPresetSuggestions({
  patientId,
  presets,
}: {
  patientId: string;
  presets: SupplementPreset[];
}) {
  const router = useRouter();
  const [applying, setApplying] = useState<string | null>(null);

  if (!presets.length) return null;

  return (
    <div className="mb-4 rounded-lg bg-accent-soft p-3.5">
      <p className="mb-2 text-sm font-semibold text-accent-strong">💡 Sugestão a partir da triagem clínica</p>
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            disabled={applying === preset.id}
            onClick={async () => {
              setApplying(preset.id);
              try {
                await applySupplementPreset(patientId, preset.id);
                router.refresh();
              } finally {
                setApplying(null);
              }
            }}
            className="rounded-full border border-accent bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-accent-strong hover:brightness-95"
          >
            {applying === preset.id ? "Aplicando…" : `Aplicar protocolo: ${preset.name}`}
          </button>
        ))}
      </div>
    </div>
  );
}
