import type { ClinicalFlag, Patient } from "@/lib/types";

export const CLINICAL_FLAG_LABELS: Record<ClinicalFlag, string> = {
  gestante_lactante: "Gestante ou lactante",
  doenca_renal_hepatica_cardiaca: "Doença renal, hepática ou cardíaca",
  diabetes_insulina: "Diabetes em uso de insulina",
  cirurgia_bariatrica: "Cirurgia bariátrica",
  transtorno_alimentar: "Histórico ou suspeita de transtorno alimentar",
};

export function yearsSince(dateStr: string) {
  const birth = new Date(dateStr);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}

export interface ScreeningResult {
  flagged: boolean;
  reasons: string[];
}

/**
 * Triagem clínica automática — 6 sinalizadores que marcam o caso como
 * "avaliação individual" e bloqueiam automação (geração automática de dieta).
 * 5 vêm de `clinical_flags` (marcados manualmente no cadastro); o 6º
 * (menor de 18) é calculado a partir da data de nascimento.
 */
export function screenPatient(patient: Pick<Patient, "birth_date" | "clinical_flags">): ScreeningResult {
  const reasons: string[] = [];

  if (yearsSince(patient.birth_date) < 18) {
    reasons.push("Paciente menor de 18 anos");
  }
  for (const flag of patient.clinical_flags) {
    if (CLINICAL_FLAG_LABELS[flag]) reasons.push(CLINICAL_FLAG_LABELS[flag]);
  }

  return { flagged: reasons.length > 0, reasons };
}
