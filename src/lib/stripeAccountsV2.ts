/**
 * A Stripe descontinuou a criação de contas Connect pela API v1
 * (`stripe.accounts.create`) para integrações novas — força o uso da v2
 * Core Accounts, que o stripe-node instalado ainda não tem tipado/exposto
 * (`stripe.v2.core.accounts`). Chama a API v2 diretamente via fetch só para
 * este passo; o resto do fluxo (account links de onboarding, retrieve de
 * status, checkout na conta conectada) continua na v1 normalmente — a
 * Stripe confirma que contas v2 são plenamente compatíveis com essas rotas.
 */
export async function createConnectAccountV2({
  email,
  displayName,
  nutritionistId,
}: {
  email: string | undefined;
  displayName: string;
  nutritionistId: string;
}): Promise<string> {
  const res = await fetch("https://api.stripe.com/v2/core/accounts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Stripe-Version": "2025-08-27.preview",
    },
    body: JSON.stringify({
      contact_email: email,
      display_name: displayName,
      dashboard: "full",
      identity: { country: "br" },
      defaults: {
        responsibilities: { fees_collector: "stripe", losses_collector: "stripe" },
      },
      configuration: { merchant: {} },
      metadata: { nutritionist_id: nutritionistId },
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message ?? "Falha ao criar conta Stripe Connect.");
  return data.id as string;
}
