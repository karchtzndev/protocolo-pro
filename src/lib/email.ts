export interface EmailMessage {
  to: string[];
  subject: string;
  text: string;
  replyTo?: string;
}

export type EmailResult =
  | { sent: true; count: number }
  | { sent: false; reason: "not_configured" | "no_recipients" | "error"; message?: string };

export function isEmailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

/**
 * Envio transacional via Resend (HTTP puro, sem SDK).
 *
 * Sem RESEND_API_KEY configurada, não falha: devolve `not_configured` e a
 * interface cai no fluxo manual (mailto/WhatsApp). Isso mantém o app
 * funcionando antes da chave existir e evita erro em produção.
 */
export async function sendEmail({ to, subject, text, replyTo }: EmailMessage): Promise<EmailResult> {
  const recipients = to.filter(Boolean);
  if (!recipients.length) return { sent: false, reason: "no_recipients" };
  if (!isEmailConfigured()) return { sent: false, reason: "not_configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        // Um e-mail por destinatário em BCC evita expor a lista de pacientes
        // uns aos outros (dado de saúde — LGPD).
        to: process.env.EMAIL_FROM,
        bcc: recipients,
        subject,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      return { sent: false, reason: "error", message: body.slice(0, 300) };
    }

    return { sent: true, count: recipients.length };
  } catch (err) {
    return { sent: false, reason: "error", message: err instanceof Error ? err.message : String(err) };
  }
}
