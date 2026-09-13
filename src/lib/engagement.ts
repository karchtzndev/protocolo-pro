import type { MealCheckin, Patient } from "@/lib/types";

/** Dias sem abrir o portal a partir dos quais o paciente entra em alerta de evasão. */
export const CHURN_RISK_DAYS = 7;

export interface EngagementSignal {
  score: number;
  daysSinceAccess: number | null;
  checkinsLast7Days: number;
  atRisk: boolean;
  reason: string | null;
}

/**
 * Score de engajamento (0–100) a partir de dois sinais objetivos: há quanto
 * tempo o paciente não abre o portal e quantas refeições ele registrou na
 * última semana. Não usa dado clínico — é sinal de uso, não de saúde.
 */
export function evaluateEngagement(
  patient: Pick<Patient, "last_portal_access_at" | "created_at">,
  checkins: MealCheckin[]
): EngagementSignal {
  const daysSinceAccess = patient.last_portal_access_at
    ? Math.floor((Date.now() - new Date(patient.last_portal_access_at).getTime()) / 86_400_000)
    : null;

  const cutoff = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
  const checkinsLast7Days = checkins.filter((c) => c.checkin_date >= cutoff).length;

  // Nunca acessou: só vira risco depois de uma semana do cadastro, senão todo
  // paciente recém-cadastrado nasceria em alerta.
  const daysSinceSignup = Math.floor((Date.now() - new Date(patient.created_at).getTime()) / 86_400_000);

  let score = 100;
  let reason: string | null = null;

  if (daysSinceAccess === null) {
    if (daysSinceSignup >= CHURN_RISK_DAYS) {
      score = 20;
      reason = `nunca acessou o portal (cadastrado há ${daysSinceSignup} dias)`;
    }
  } else if (daysSinceAccess >= CHURN_RISK_DAYS * 2) {
    score = 10;
    reason = `sem acessar o portal há ${daysSinceAccess} dias`;
  } else if (daysSinceAccess >= CHURN_RISK_DAYS) {
    score = 35;
    reason = `sem acessar o portal há ${daysSinceAccess} dias`;
  } else if (checkinsLast7Days === 0) {
    score = 60;
    reason = "abriu o app, mas não registrou nenhuma refeição na semana";
  } else {
    score = Math.min(100, 60 + checkinsLast7Days * 4);
  }

  return { score, daysSinceAccess, checkinsLast7Days, atRisk: score <= 35, reason };
}
