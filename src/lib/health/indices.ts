export interface AnthropometricIndices {
  imc: number | null;
  imcClassification: string | null;
  rcq: number | null;
  rcqRisk: string | null;
  rce: number | null;
  rceRisk: string | null;
}

export function calculateIndices({
  weightKg,
  heightM,
  waistCm,
  hipCm,
  sex,
}: {
  weightKg: number | null;
  heightM: number | null;
  waistCm: number | null;
  hipCm: number | null;
  sex: "feminino" | "masculino" | "outro" | null;
}): AnthropometricIndices {
  const imc = weightKg && heightM ? weightKg / (heightM * heightM) : null;
  const rcq = waistCm && hipCm ? waistCm / hipCm : null;
  const rce = waistCm && heightM ? waistCm / (heightM * 100) : null;

  return {
    imc: imc !== null ? round1(imc) : null,
    imcClassification: imc !== null ? classifyImc(imc) : null,
    rcq: rcq !== null ? round2(rcq) : null,
    rcqRisk: rcq !== null ? classifyRcq(rcq, sex) : null,
    rce: rce !== null ? round2(rce) : null,
    rceRisk: rce !== null ? classifyRce(rce) : null,
  };
}

function classifyImc(imc: number) {
  if (imc < 18.5) return "Abaixo do peso";
  if (imc < 25) return "Peso normal";
  if (imc < 30) return "Sobrepeso";
  if (imc < 35) return "Obesidade grau I";
  if (imc < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

function classifyRcq(rcq: number, sex: "feminino" | "masculino" | "outro" | null) {
  const threshold = sex === "masculino" ? 0.9 : 0.85;
  return rcq >= threshold ? "Risco cardiovascular aumentado" : "Risco cardiovascular normal";
}

function classifyRce(rce: number) {
  if (rce < 0.4) return "Abaixo do esperado";
  if (rce <= 0.5) return "Risco baixo";
  if (rce <= 0.6) return "Risco aumentado";
  return "Risco muito aumentado";
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
