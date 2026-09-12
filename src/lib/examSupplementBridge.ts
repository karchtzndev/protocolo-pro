/**
 * Ponte exame → suplementação: um marcador confirmado e fora da faixa gera
 * uma sugestão mapeada para um dos 10 protocolos pré-montados. A sugestão
 * ainda precisa ser aplicada manualmente pelo profissional — nunca é
 * prescrita sozinha.
 */
const MARKER_TO_PRESET: Record<string, string> = {
  TSH: "Hipotireoidismo",
  "T4 Livre": "Hipotireoidismo",
  Ferritina: "Anemia ferropriva",
  "Ferro Sérico": "Anemia ferropriva",
  Hemoglobina: "Anemia ferropriva",
  "Glicemia de Jejum": "Diabetes tipo 2 e resistência insulínica",
  "Hemoglobina Glicada (HbA1c)": "Diabetes tipo 2 e resistência insulínica",
  "Insulina de Jejum": "Diabetes tipo 2 e resistência insulínica",
  "HOMA-IR": "Diabetes tipo 2 e resistência insulínica",
  "Vitamina D (25-OH)": "Osteoporose e osteopenia",
  "Cálcio Total": "Osteoporose e osteopenia",
  "Cálcio Iônico": "Osteoporose e osteopenia",
};

export function suggestedPresetForMarker(testName: string): string | null {
  return MARKER_TO_PRESET[testName] ?? null;
}
