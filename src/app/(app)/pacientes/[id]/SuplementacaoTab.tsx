import type { Patient, PatientSupplement, SupplementCatalogItem, SupplementPreset } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SupplementPrescribeDialog } from "./SupplementPrescribeDialog";
import { SignPrescriptionButton } from "./SignPrescriptionButton";
import { RemoveSupplementButton } from "./RemoveSupplementButton";
import { ClinicalPresetSuggestions } from "./ClinicalPresetSuggestions";
import { suggestedPresetsForFlags } from "@/lib/clinicalPresetBridge";

const EVIDENCE_LABEL: Record<string, string> = {
  alta: "Evidência alta",
  moderada: "Evidência moderada",
  baixa: "Evidência baixa",
  insuficiente: "Evidência insuficiente",
};

const EVIDENCE_TONE: Record<string, "success" | "warning" | "neutral"> = {
  alta: "success",
  moderada: "neutral",
  baixa: "warning",
  insuficiente: "warning",
};

export function SuplementacaoTab({
  patient,
  patientId,
  prescribed,
  catalog,
  presets,
}: {
  patient: Patient;
  patientId: string;
  prescribed: PatientSupplement[];
  catalog: SupplementCatalogItem[];
  presets: SupplementPreset[];
}) {
  const overdoseWarnings = checkOverdose(prescribed);
  const hasUnsigned = prescribed.some((p) => !p.signed_at);
  const suggestedNames = suggestedPresetsForFlags(patient.clinical_flags);

  return (
    <div>
      <ClinicalPresetSuggestions
        patientId={patientId}
        presets={presets.filter((p) => suggestedNames.includes(p.name))}
      />

      {overdoseWarnings.map((w) => (
        <div key={w.supplementId} className="mb-4 flex items-start gap-2.5 rounded-lg bg-warning-soft p-3.5 text-sm font-medium text-warning">
          ⚠
          <span>
            <b>Atenção à dosagem combinada:</b> {w.message}
          </span>
        </div>
      ))}

      <div className="mb-4 flex justify-end gap-2">
        {hasUnsigned && <SignPrescriptionButton patientId={patientId} />}
        <SupplementPrescribeDialog patientId={patientId} catalog={catalog} presets={presets} />
      </div>

      <div className="mb-6 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
          <h3 className="text-sm font-semibold">Suplementos prescritos</h3>
          <Badge tone="neutral">{prescribed.length} itens</Badge>
        </div>
        <div className="px-4">
          {prescribed.length ? (
            prescribed.map((item) => {
              const flagged = overdoseWarnings.some((w) => w.supplementId === item.supplement_id);
              return (
                <div key={item.id} className="flex items-center justify-between border-b border-[var(--border-soft)] py-2.5 last:border-none">
                  <div>
                    <b className="block text-[13.5px] font-semibold">{item.supplement?.name}</b>
                    <span className="text-xs text-[var(--ink-soft)]">
                      {item.dose} {item.dose_unit} — {item.schedule}
                    </span>
                    {item.justification && (
                      <span className="mt-1 block text-[11px] text-warning">Justificativa: {item.justification}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={flagged ? "warning" : "success"}>{flagged ? "verificar" : "ok"}</Badge>
                    <Badge tone={item.signed_at ? "success" : "neutral"}>{item.signed_at ? "assinado" : "rascunho"}</Badge>
                    {!item.signed_at && <RemoveSupplementButton patientId={patientId} supplementRowId={item.id} />}
                  </div>
                </div>
              );
            })
          ) : (
            <p className="py-4 text-sm text-[var(--ink-soft)]">Nenhum suplemento prescrito ainda.</p>
          )}
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Catálogo de suplementos</h3>
        <Badge tone="neutral">exibindo {Math.min(catalog.length, 8)} de {catalog.length}</Badge>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {catalog.slice(0, 8).map((item) => (
          <div key={item.id} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3">
            <b className="block text-xs font-semibold">{item.name}</b>
            <span className="text-[11px] text-[var(--ink-faint)]">{item.description}</span>
            <div className="mt-1.5 flex flex-wrap gap-1">
              {item.evidence_level && (
                <Badge tone={EVIDENCE_TONE[item.evidence_level]}>{EVIDENCE_LABEL[item.evidence_level]}</Badge>
              )}
              {item.requires_fitoterapia_license && <Badge tone="warning">fitoterapia</Badge>}
            </div>
          </div>
        ))}
      </div>

      <a href={`/api/pdf/suplementacao/${patientId}`} target="_blank" rel="noreferrer">
        <Button variant="accent">⭳ Gerar PDF de suplementação</Button>
      </a>
    </div>
  );
}

/**
 * Soma a dose diária de cada suplemento prescrito (várias entradas do mesmo
 * suplemento em horários diferentes se acumulam) e compara com o limite
 * `max_daily_dose` do catálogo.
 */
function checkOverdose(prescribed: PatientSupplement[]) {
  const totals = new Map<string, { total: number; item: PatientSupplement }>();

  for (const p of prescribed) {
    const current = totals.get(p.supplement_id);
    totals.set(p.supplement_id, { total: (current?.total ?? 0) + Number(p.dose), item: p });
  }

  const warnings: { supplementId: string; message: string }[] = [];
  for (const [supplementId, { total, item }] of totals) {
    const max = item.supplement?.max_daily_dose;
    if (max && total > max) {
      warnings.push({
        supplementId,
        message: `${item.supplement?.name} combinado ultrapassa ${max} ${item.dose_unit}/dia recomendado (total prescrito: ${total} ${item.dose_unit}).`,
      });
    }
  }
  return warnings;
}
