import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type AuditActionType =
  | "paciente.arquivar"
  | "antropometria.registrar"
  | "plano.criar"
  | "protocolo.trocar_item"
  | "protocolo.publicar"
  | "protocolo.revogar_link"
  | "exame.enviar"
  | "exame.reprocessar"
  | "exame.confirmar"
  | "suplementacao.salvar"
  | "suplementacao.assinar"
  | "perfil.atualizar"
  | "dados.exportar"
  | "conta.solicitar_exclusao"
  | "consulta.agendar"
  | "consulta.cancelar";

/** Trunca o IP para preservar privacidade — último octeto (IPv4) ou último grupo (IPv6). */
async function getTruncatedIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim();
  if (!ip) return null;

  if (ip.includes(".")) {
    return ip.split(".").slice(0, 3).concat("0").join(".");
  }
  if (ip.includes(":")) {
    return ip.split(":").slice(0, -1).concat("0").join(":");
  }
  return null;
}

export async function logAudit(
  nutritionistId: string,
  actionType: AuditActionType,
  options?: { targetType?: string; targetId?: string; metadata?: Record<string, unknown> }
) {
  const supabase = await createClient();
  const ip = await getTruncatedIp();

  await supabase.from("audit_log").insert({
    nutritionist_id: nutritionistId,
    action_type: actionType,
    target_type: options?.targetType ?? null,
    target_id: options?.targetId ?? null,
    ip_truncated: ip,
    metadata: options?.metadata ?? {},
  });
}
