"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { moveStage, updateTags } from "./actions";
import type { CrmStage, Patient } from "@/lib/types";

export function PatientCard({
  patient,
  stages,
  flagged,
  churnReason,
}: {
  patient: Patient;
  stages: CrmStage[];
  flagged: boolean;
  churnReason?: string | null;
}) {
  const [editingTags, setEditingTags] = useState(false);
  const [tagsInput, setTagsInput] = useState(patient.tags.join(", "));
  const [isPending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3 shadow-sm">
      <Link href={`/pacientes/${patient.id}`} className="block truncate text-[13px] font-semibold hover:underline">
        {patient.full_name}
      </Link>
      <span className="block truncate text-[11px] text-[var(--ink-soft)]">{patient.objective ?? "—"}</span>

      {(flagged || churnReason) && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {flagged && <Badge tone="warning">⚠ atenção</Badge>}
          {churnReason && <Badge tone="danger">📉 {churnReason}</Badge>}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-1">
        {patient.tags.map((t) => (
          <span key={t} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-soft)]">
            {t}
          </span>
        ))}
        <button
          type="button"
          onClick={() => setEditingTags((v) => !v)}
          className="rounded-full border border-dashed border-[var(--border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--ink-faint)]"
        >
          {editingTags ? "fechar" : "+ tag"}
        </button>
      </div>

      {editingTags && (
        <div className="mt-2 flex gap-1.5">
          <input
            value={tagsInput}
            onChange={(e) => setTagsInput(e.target.value)}
            placeholder="vip, indicação, ..."
            className="min-w-0 flex-1 rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-[11px]"
          />
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await updateTags(patient.id, tagsInput);
                setEditingTags(false);
              })
            }
            className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-brand-on"
          >
            Salvar
          </button>
        </div>
      )}

      <select
        value={patient.stage_id ?? ""}
        disabled={isPending}
        onChange={(e) => startTransition(() => moveStage(patient.id, e.target.value))}
        className="mt-2.5 w-full rounded-md border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-[11px]"
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            Mover para: {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
