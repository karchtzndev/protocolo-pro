"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";

/**
 * Agenda a consulta e, no mesmo passo, cria a ficha de anamnese pendente
 * vinculada — ela aparece automaticamente no portal do próprio paciente
 * (/p/[slug]), o mesmo link que ele já usa para ver o protocolo.
 */
export async function scheduleAppointment(patientId: string, formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const scheduledAt = String(formData.get("scheduled_at") || "");
  const notes = String(formData.get("notes") || "") || null;
  if (!scheduledAt) throw new Error("Escolha data e horário.");

  const { count: priorAppointments } = await supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("patient_id", patientId);
  const isFirstConsultation = (priorAppointments ?? 0) === 0;

  const { data: appointment, error } = await supabase
    .from("appointments")
    .insert({
      patient_id: patientId,
      nutritionist_id: user.id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      notes,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // A anamnese só é enviada automaticamente na primeira consulta — nas
  // seguintes, o profissional já tem o histórico do paciente.
  if (isFirstConsultation) {
    const { error: anamnesisError } = await supabase.from("anamnesis_responses").insert({
      patient_id: patientId,
      appointment_id: appointment.id,
    });
    if (anamnesisError) throw new Error(anamnesisError.message);
  }

  await logAudit(user.id, "consulta.agendar", { targetType: "patient", targetId: patientId });

  revalidatePath(`/pacientes/${patientId}`);
  revalidatePath("/agendamentos");
}

export async function cancelAppointment(patientId: string, appointmentId: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase.from("appointments").update({ status: "cancelado" }).eq("id", appointmentId);
  if (error) throw new Error(error.message);

  await logAudit(user.id, "consulta.cancelar", { targetType: "appointment", targetId: appointmentId });

  revalidatePath(`/pacientes/${patientId}`);
}

export async function completeAppointment(patientId: string, appointmentId: string) {
  await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase.from("appointments").update({ status: "concluido" }).eq("id", appointmentId);
  if (error) throw new Error(error.message);

  revalidatePath(`/pacientes/${patientId}`);
}
