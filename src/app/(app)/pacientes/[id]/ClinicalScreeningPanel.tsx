"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import type { ClinicalFlag, Patient } from "@/lib/types";
import { CLINICAL_FLAG_LABELS, screenPatient, yearsSince } from "@/lib/clinicalScreening";
import { updateClinicalFlags } from "../actions";

const ALL_FLAGS = Object.keys(CLINICAL_FLAG_LABELS) as ClinicalFlag[];

export function ClinicalScreeningPanel({ patient }: { patient: Patient }) {
  const router = useRouter();
  const [flags, setFlags] = useState<ClinicalFlag[]>(patient.clinical_flags);
  const [saving, setSaving] = useState(false);

  const isMinor = yearsSince(patient.birth_date) < 18;
  const screening = screenPatient({ birth_date: patient.birth_date, clinical_flags: flags });

  function toggle(flag: ClinicalFlag) {
    setFlags((prev) => (prev.includes(flag) ? prev.filter((f) => f !== flag) : [...prev, flag]));
  }

  async function save() {
    setSaving(true);
    try {
      await updateClinicalFlags(patient.id, flags);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Triagem clínica</h3>
        {screening.flagged ? (
          <Badge tone="warning">avaliação individual</Badge>
        ) : (
          <Badge tone="success">sem sinalização</Badge>
        )}
      </div>

      {isMinor && (
        <p className="mb-2 text-xs text-warning">⚠ Paciente menor de 18 anos — automação bloqueada automaticamente.</p>
      )}

      <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {ALL_FLAGS.map((flag) => (
          <label key={flag} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={flags.includes(flag)} onChange={() => toggle(flag)} />
            {CLINICAL_FLAG_LABELS[flag]}
          </label>
        ))}
      </div>

      {screening.flagged && (
        <p className="mb-3 text-xs text-[var(--ink-soft)]">
          Casos sinalizados bloqueiam a geração automática de protocolo — o profissional deve montar o plano manualmente.
        </p>
      )}

      <button
        type="button"
        disabled={saving || JSON.stringify(flags) === JSON.stringify(patient.clinical_flags)}
        onClick={save}
        className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-brand-on disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar triagem"}
      </button>
    </div>
  );
}
