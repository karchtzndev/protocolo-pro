import type { ClinicalFlag } from "@/lib/types";

/**
 * Sinalizadores de triagem clínica que têm um protocolo de suplementação
 * pré-montado diretamente aplicável. Sinalizadores sem preset seguro
 * (doença renal/hepática/cardíaca, cirurgia bariátrica, transtorno alimentar)
 * ficam de fora de propósito — exigem avaliação individual, não sugestão automática.
 */
const FLAG_TO_PRESETS: Partial<Record<ClinicalFlag, string[]>> = {
  gestante_lactante: ["Gestação", "Lactação"],
  diabetes_insulina: ["Diabetes tipo 2 e resistência insulínica"],
};

export function suggestedPresetsForFlags(flags: ClinicalFlag[]): string[] {
  const names = new Set<string>();
  for (const flag of flags) {
    for (const name of FLAG_TO_PRESETS[flag] ?? []) names.add(name);
  }
  return Array.from(names);
}
