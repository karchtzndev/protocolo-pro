"use client";

import { useRouter } from "next/navigation";
import { archivePatient } from "../actions";

export function ArchivePatientButton({ patientId, status }: { patientId: string; status: string }) {
  const router = useRouter();
  if (status === "inativo") return null;

  return (
    <button
      type="button"
      onClick={async () => {
        if (!confirm("Arquivar este paciente? O histórico é preservado, mas ele deixa de aparecer como ativo.")) return;
        await archivePatient(patientId);
        router.refresh();
      }}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-danger hover:bg-danger-soft"
    >
      Arquivar paciente
    </button>
  );
}
