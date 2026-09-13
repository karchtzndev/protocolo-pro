"use server";

import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { sendPushToPatient } from "@/lib/push";

export async function sendReminderPush(
  patientId: string
): Promise<{ sent: number; reason?: "not_configured" }> {
  await requireActiveSubscription();
  return sendPushToPatient(patientId, {
    title: "Lembrete do seu nutricionista",
    body: "Não esqueça de marcar suas refeições de hoje no app.",
    url: "/",
  });
}
