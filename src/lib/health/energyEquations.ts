export type ActivityLevel = "sedentario" | "leve" | "moderado" | "ativo" | "muito_ativo";
export type Sex = "feminino" | "masculino";

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentario: 1.2,
  leve: 1.375,
  moderado: 1.55,
  ativo: 1.725,
  muito_ativo: 1.9,
};

export interface EnergyInput {
  sex: Sex;
  ageYears: number;
  weightKg: number;
  heightCm: number;
  leanMassKg: number | null;
  activityLevel: ActivityLevel;
}

export interface EnergyResult {
  key: "mifflin" | "harris_benedict" | "cunningham" | "katch_mcardle";
  label: string;
  available: boolean;
  unavailableReason?: string;
  bmrKcal: number | null;
  tdeeKcal: number | null;
}

function mifflinStJeor({ sex, ageYears, weightKg, heightCm }: EnergyInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === "masculino" ? base + 5 : base - 161;
}

/** Harris-Benedict revisado por Roza & Shizgal (1984). */
function harrisBenedict({ sex, ageYears, weightKg, heightCm }: EnergyInput): number {
  return sex === "masculino"
    ? 88.362 + 13.397 * weightKg + 4.799 * heightCm - 5.677 * ageYears
    : 447.593 + 9.247 * weightKg + 3.098 * heightCm - 4.33 * ageYears;
}

function cunningham(leanMassKg: number): number {
  return 500 + 22 * leanMassKg;
}

function katchMcArdle(leanMassKg: number): number {
  return 370 + 21.6 * leanMassKg;
}

export function calculateEnergyEquations(input: EnergyInput): EnergyResult[] {
  const factor = ACTIVITY_FACTOR[input.activityLevel];

  const mifflinBmr = mifflinStJeor(input);
  const harrisBmr = harrisBenedict(input);
  const hasLeanMass = input.leanMassKg !== null && input.leanMassKg > 0;
  const cunninghamBmr = hasLeanMass ? cunningham(input.leanMassKg as number) : null;
  const katchBmr = hasLeanMass ? katchMcArdle(input.leanMassKg as number) : null;

  return [
    {
      key: "mifflin",
      label: "Mifflin-St Jeor",
      available: true,
      bmrKcal: round(mifflinBmr),
      tdeeKcal: round(mifflinBmr * factor),
    },
    {
      key: "harris_benedict",
      label: "Harris-Benedict (Roza & Shizgal)",
      available: true,
      bmrKcal: round(harrisBmr),
      tdeeKcal: round(harrisBmr * factor),
    },
    {
      key: "cunningham",
      label: "Cunningham",
      available: hasLeanMass,
      unavailableReason: hasLeanMass ? undefined : "Requer massa livre de gordura aferida.",
      bmrKcal: cunninghamBmr !== null ? round(cunninghamBmr) : null,
      tdeeKcal: cunninghamBmr !== null ? round(cunninghamBmr * factor) : null,
    },
    {
      key: "katch_mcardle",
      label: "Katch-McArdle",
      available: hasLeanMass,
      unavailableReason: hasLeanMass ? undefined : "Requer massa livre de gordura aferida.",
      bmrKcal: katchBmr !== null ? round(katchBmr) : null,
      tdeeKcal: katchBmr !== null ? round(katchBmr * factor) : null,
    },
  ];
}

function round(n: number) {
  return Math.round(n);
}

export const ACTIVITY_LEVEL_LABELS: Record<ActivityLevel, string> = {
  sedentario: "Sedentário",
  leve: "Leve (1-3x/semana)",
  moderado: "Moderado (3-5x/semana)",
  ativo: "Ativo (6-7x/semana)",
  muito_ativo: "Muito ativo (2x/dia ou físico)",
};
