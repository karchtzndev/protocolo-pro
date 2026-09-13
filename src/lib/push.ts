import webpush from "web-push";
import { createServiceRoleClient } from "@/lib/supabase/server";

export function isPushConfigured() {
  return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

function configure() {
  webpush.setVapidDetails(
    "mailto:contato@protocolo.pro",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
}

/**
 * Envia uma notificação para todos os dispositivos em que o paciente ativou
 * push. Assinaturas mortas (410/404 — o navegador desinstalou o app, limpou
 * dados, etc.) são removidas do banco em vez de tentar de novo depois.
 */
export async function sendPushToPatient(
  patientId: string,
  payload: { title: string; body: string; url?: string }
): Promise<{ sent: number; reason?: "not_configured" }> {
  if (!isPushConfigured()) return { sent: 0, reason: "not_configured" };
  configure();

  const supabase = createServiceRoleClient();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("*")
    .eq("patient_id", patientId);

  if (!subscriptions?.length) return { sent: 0 };

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      }
    }
  }

  return { sent };
}
