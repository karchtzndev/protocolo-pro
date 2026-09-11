import type { Sex } from "./energyEquations";

export interface SkinfoldInput {
  sex: Sex;
  ageYears: number;
  chest?: number | null;
  midaxillary?: number | null;
  triceps?: number | null;
  subscapular?: number | null;
  abdominal?: number | null;
  suprailiac?: number | null;
  thigh?: number | null;
  bicep?: number | null;
}

export interface SkinfoldResult {
  key: "jp3" | "jp7" | "durnin_womersley" | "faulkner";
  label: string;
  available: boolean;
  missingFields?: string[];
  bodyDensity: number | null;
  bodyFatPct: number | null;
}

/** Siri (1961): converte densidade corporal em % de gordura. */
function siri(bodyDensity: number) {
  return 495 / bodyDensity - 450;
}

function haveAll(values: (number | null | undefined)[]) {
  return values.every((v) => typeof v === "number" && Number.isFinite(v));
}

function jacksonPollock3({ sex, ageYears, chest, abdominal, thigh, triceps, suprailiac }: SkinfoldInput): SkinfoldResult {
  const missing: string[] = [];
  let sum: number | null = null;

  if (sex === "masculino") {
    if (!haveAll([chest, abdominal, thigh])) {
      if (chest == null) missing.push("peitoral");
      if (abdominal == null) missing.push("abdominal");
      if (thigh == null) missing.push("coxa");
    } else {
      sum = (chest as number) + (abdominal as number) + (thigh as number);
    }
  } else {
    if (!haveAll([triceps, suprailiac, thigh])) {
      if (triceps == null) missing.push("tríceps");
      if (suprailiac == null) missing.push("suprailíaca");
      if (thigh == null) missing.push("coxa");
    } else {
      sum = (triceps as number) + (suprailiac as number) + (thigh as number);
    }
  }

  if (sum === null) {
    return { key: "jp3", label: "Jackson & Pollock 3 dobras", available: false, missingFields: missing, bodyDensity: null, bodyFatPct: null };
  }

  const bd =
    sex === "masculino"
      ? 1.10938 - 0.0008267 * sum + 0.0000016 * sum ** 2 - 0.0002574 * ageYears
      : 1.0994921 - 0.0009929 * sum + 0.0000023 * sum ** 2 - 0.0001392 * ageYears;

  return { key: "jp3", label: "Jackson & Pollock 3 dobras", available: true, bodyDensity: round4(bd), bodyFatPct: round1(siri(bd)) };
}

function jacksonPollock7(input: SkinfoldInput): SkinfoldResult {
  const { sex, ageYears, chest, midaxillary, triceps, subscapular, abdominal, suprailiac, thigh } = input;
  const fields = { chest, midaxillary, triceps, subscapular, abdominal, suprailiac, thigh };
  const missing = Object.entries(fields)
    .filter(([, v]) => v == null)
    .map(([k]) => k);

  if (missing.length) {
    return { key: "jp7", label: "Jackson & Pollock 7 dobras", available: false, missingFields: missing, bodyDensity: null, bodyFatPct: null };
  }

  const sum = (chest as number) + (midaxillary as number) + (triceps as number) + (subscapular as number) + (abdominal as number) + (suprailiac as number) + (thigh as number);

  const bd =
    sex === "masculino"
      ? 1.112 - 0.00043499 * sum + 0.00000055 * sum ** 2 - 0.00028826 * ageYears
      : 1.097 - 0.00046971 * sum + 0.00000056 * sum ** 2 - 0.00012828 * ageYears;

  return { key: "jp7", label: "Jackson & Pollock 7 dobras", available: true, bodyDensity: round4(bd), bodyFatPct: round1(siri(bd)) };
}

const DURNIN_WOMERSLEY_COEFFICIENTS: { max: number; men: [number, number]; women: [number, number] }[] = [
  { max: 19, men: [1.162, 0.063], women: [1.1549, 0.0678] },
  { max: 29, men: [1.1631, 0.0632], women: [1.1599, 0.0717] },
  { max: 39, men: [1.1422, 0.0544], women: [1.1423, 0.0632] },
  { max: 49, men: [1.162, 0.07], women: [1.1333, 0.0612] },
  { max: Infinity, men: [1.1715, 0.0779], women: [1.1339, 0.0645] },
];

function durninWomersley({ sex, ageYears, bicep, triceps, subscapular, suprailiac }: SkinfoldInput): SkinfoldResult {
  const fields = { bicep, triceps, subscapular, suprailiac };
  const missing = Object.entries(fields)
    .filter(([, v]) => v == null)
    .map(([k]) => k);

  if (missing.length) {
    return { key: "durnin_womersley", label: "Durnin & Womersley", available: false, missingFields: missing, bodyDensity: null, bodyFatPct: null };
  }

  const sum = (bicep as number) + (triceps as number) + (subscapular as number) + (suprailiac as number);
  const bracket = DURNIN_WOMERSLEY_COEFFICIENTS.find((b) => ageYears <= b.max) ?? DURNIN_WOMERSLEY_COEFFICIENTS[DURNIN_WOMERSLEY_COEFFICIENTS.length - 1];
  const [c, m] = sex === "masculino" ? bracket.men : bracket.women;
  const bd = c - m * Math.log10(sum);

  return { key: "durnin_womersley", label: "Durnin & Womersley", available: true, bodyDensity: round4(bd), bodyFatPct: round1(siri(bd)) };
}

/** Faulkner (1968): fórmula direta de %gordura, sem passar por densidade corporal. */
function faulkner({ triceps, subscapular, suprailiac, abdominal }: SkinfoldInput): SkinfoldResult {
  const fields = { triceps, subscapular, suprailiac, abdominal };
  const missing = Object.entries(fields)
    .filter(([, v]) => v == null)
    .map(([k]) => k);

  if (missing.length) {
    return { key: "faulkner", label: "Faulkner", available: false, missingFields: missing, bodyDensity: null, bodyFatPct: null };
  }

  const sum = (triceps as number) + (subscapular as number) + (suprailiac as number) + (abdominal as number);
  const bodyFatPct = sum * 0.153 + 5.783;

  return { key: "faulkner", label: "Faulkner", available: true, bodyDensity: null, bodyFatPct: round1(bodyFatPct) };
}

export function calculateSkinfoldProtocols(input: SkinfoldInput): SkinfoldResult[] {
  return [jacksonPollock3(input), jacksonPollock7(input), durninWomersley(input), faulkner(input)];
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
function round1(n: number) {
  return Math.round(n * 10) / 10;
}
