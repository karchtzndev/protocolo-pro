import type { Patient } from "@/lib/types";
import { ArchivePatientButton } from "./ArchivePatientButton";
import { ClinicalScreeningPanel } from "./ClinicalScreeningPanel";

export function CadastroTab({ patient }: { patient: Patient }) {
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <ArchivePatientButton patientId={patient.id} status={patient.status} />
      </div>

      <ClinicalScreeningPanel patient={patient} />

      <div className="mb-4 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <ReadField label="Nascimento" value={new Date(patient.birth_date).toLocaleDateString("pt-BR")} />
        <ReadField label="Sexo" value={patient.sex ?? "—"} />
        <ReadField label="Telefone" value={patient.phone ?? "—"} />
        <ReadField label="E-mail" value={patient.email ?? "—"} />
      </div>

      <ReadField label="Objetivos" value={patient.objective ?? "Nenhum objetivo registrado."} className="mb-4" />

      <div className="mb-4">
        <FieldLabel>Restrições e alergias</FieldLabel>
        {patient.restrictions.length ? (
          <div className="flex flex-wrap gap-1.5">
            {patient.restrictions.map((r) => (
              <span key={r} className="rounded-full bg-warning-soft px-2.5 py-1 text-xs text-warning">
                {r}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--ink-soft)]">Nenhuma restrição registrada.</p>
        )}
      </div>

      <ReadField label="Histórico clínico" value={patient.clinical_history ?? "Sem histórico registrado."} />
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function ReadField({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <FieldLabel>{label}</FieldLabel>
      <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] px-3 py-2.5 text-sm">
        {value}
      </div>
    </div>
  );
}
