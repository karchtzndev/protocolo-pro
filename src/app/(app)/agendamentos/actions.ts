"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";

/**
 * Agenda a primeira consulta de um paciente novo — cadastra o paciente,
 * cria o agendamento e a anamnese pendente em um único passo.
 */
export async function createPatientAndSchedule(formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const scheduledAt = String(formData.get("scheduled_at") || "");
  if (!scheduledAt) throw new Error("Escolha data e horário.");

  const { data: patient, error: patientError } = await supabase
    .from("patients")
    .insert({
      nutritionist_id: user.id,
      full_name: String(formData.get("full_name")),
      birth_date: String(formData.get("birth_date")),
      sex: String(formData.get("sex") || "") || null,
      phone: String(formData.get("phone") || "") || null,
      email: String(formData.get("email") || "") || null,
      status: "pendente",
    })
    .select()
    .single();
  if (patientError) throw new Error(patientError.message);

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      patient_id: patient.id,
      nutritionist_id: user.id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      notes: String(formData.get("notes") || "") || null,
    })
    .select()
    .single();
  if (appointmentError) throw new Error(appointmentError.message);

  const { error: anamnesisError } = await supabase.from("anamnesis_responses").insert({
    patient_id: patient.id,
    appointment_id: appointment.id,
  });
  if (anamnesisError) throw new Error(anamnesisError.message);

  await logAudit(user.id, "consulta.agendar", { targetType: "patient", targetId: patient.id, metadata: { newPatient: true } });

  revalidatePath("/agendamentos");
  revalidatePath("/pacientes");
}
