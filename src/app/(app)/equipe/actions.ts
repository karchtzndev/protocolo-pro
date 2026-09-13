"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { sendEmail } from "@/lib/email";
import { randomToken } from "@/lib/patientLinks";
import { logAudit } from "@/lib/audit";

/** Só o dono de uma clínica no plano Clínica pode montar equipe. */
async function requireClinicOwner() {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { data: me } = await supabase
    .from("nutritionists")
    .select("id, clinic_id, plan, full_name, clinic_name")
    .eq("id", user.id)
    .single();

  if (!me) throw new Error("Perfil não encontrado.");
  if (me.clinic_id !== me.id) throw new Error("Você faz parte de uma clínica, mas não é o responsável por ela.");
  if (me.plan !== "clinica") throw new Error("Equipe está disponível no plano Clínica. Faça upgrade em Configurações.");

  return { user, supabase, me };
}

export async function inviteMember(formData: FormData) {
  const { user, supabase, me } = await requireClinicOwner();

  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) throw new Error("Informe o e-mail do profissional.");

  const token = `${randomToken(6)}${randomToken(6)}`;

  const { error } = await supabase.from("clinic_invites").insert({ clinic_id: me.id, email, token });
  if (error) throw new Error(error.message);

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/equipe/aceitar/${token}`;
  await sendEmail({
    to: [email],
    subject: `Convite para a equipe de ${me.clinic_name ?? me.full_name}`,
    text: `${me.full_name} convidou você para atender junto no Protocolo.Pro.\n\nCrie sua conta (ou entre na existente) e aceite o convite neste link:\n${inviteUrl}\n\nO convite expira em 14 dias.`,
    replyTo: user.email,
  });

  await logAudit(user.id, "perfil.atualizar", {
    targetType: "clinic_invite",
    targetId: me.id,
    metadata: { action: "convidar_profissional" },
  });

  revalidatePath("/equipe");
}

export async function revokeInvite(inviteId: string) {
  const { supabase, me } = await requireClinicOwner();

  const { error } = await supabase.from("clinic_invites").delete().eq("id", inviteId).eq("clinic_id", me.id);
  if (error) throw new Error(error.message);

  revalidatePath("/equipe");
}

/** Remove o profissional da clínica — ele volta a ser dono da própria carteira. */
export async function removeMember(memberId: string) {
  const { supabase, me } = await requireClinicOwner();
  if (memberId === me.id) throw new Error("O responsável não pode sair da própria clínica.");

  const { error } = await supabase
    .from("nutritionists")
    .update({ clinic_id: memberId })
    .eq("id", memberId)
    .eq("clinic_id", me.id);
  if (error) throw new Error(error.message);

  revalidatePath("/equipe");
}

/** Aceite do convite pelo profissional convidado (já logado na própria conta). */
export async function acceptInvite(token: string): Promise<{ clinicName: string }> {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { data: invite } = await supabase
    .from("clinic_invites")
    .select("id, clinic_id, email, accepted_at, expires_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) throw new Error("Convite não encontrado.");
  if (invite.accepted_at) throw new Error("Este convite já foi utilizado.");
  if (new Date(invite.expires_at) < new Date()) throw new Error("Este convite expirou.");
  if (invite.email.toLowerCase() !== (user.email ?? "").toLowerCase()) {
    throw new Error("Este convite foi enviado para outro e-mail. Entre com a conta convidada.");
  }

  const { data: clinic } = await supabase
    .from("nutritionists")
    .select("full_name, clinic_name")
    .eq("id", invite.clinic_id)
    .single();

  const { error: joinError } = await supabase
    .from("nutritionists")
    .update({ clinic_id: invite.clinic_id })
    .eq("id", user.id);
  if (joinError) throw new Error(joinError.message);

  // O funil passa a ser o da clínica — remove as colunas próprias criadas no
  // cadastro para não duplicar estágios na tela do CRM.
  await supabase.from("crm_stages").delete().eq("nutritionist_id", user.id);

  await supabase
    .from("clinic_invites")
    .update({ accepted_at: new Date().toISOString(), accepted_by: user.id })
    .eq("id", invite.id);

  revalidatePath("/equipe");
  revalidatePath("/pacientes");

  return { clinicName: clinic?.clinic_name ?? clinic?.full_name ?? "a clínica" };
}
