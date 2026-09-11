"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";

/** O profissional revisa e corrige antes de aceitar — nunca é aceito automaticamente. */
export async function confirmExamResult(patientId: string, resultId: string, correctedValue: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("exam_results")
    .update({ result_value: correctedValue, confirmed: true })
    .eq("id", resultId);
  if (error) throw new Error(error.message);

  await logAudit(user.id, "exame.confirmar", { targetType: "exam_result", targetId: resultId });

  revalidatePath(`/pacientes/${patientId}`);
}

export async function addManualExamResult(patientId: string, examId: string, formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const testName = String(formData.get("test_name") || "");
  const resultValue = String(formData.get("result_value") || "");
  const referenceRange = String(formData.get("reference_range") || "") || null;
  if (!testName || !resultValue) throw new Error("Preencha o nome do exame e o resultado.");

  const outOfRange = referenceRange ? isOutOfRange(resultValue, referenceRange) : false;

  const { error } = await supabase.from("exam_results").insert({
    exam_id: examId,
    test_name: testName,
    result_value: resultValue,
    reference_range: referenceRange,
    out_of_range: outOfRange,
    metodo_extracao: null,
    confirmed: true,
  });
  if (error) throw new Error(error.message);

  await supabase.from("exams").update({ status: "concluido" }).eq("id", examId);

  await logAudit(user.id, "exame.confirmar", { targetType: "exam", targetId: examId, metadata: { manual: true } });

  revalidatePath(`/pacientes/${patientId}`);
}

function isOutOfRange(rawValue: string, range: string): boolean {
  const value = Number(rawValue.replace(",", ".").match(/[\d.]+/)?.[0] ?? "");
  const bounds = range.match(/[\d.,]+/g)?.map((n) => Number(n.replace(",", ".")));
  if (!bounds || bounds.length < 2 || Number.isNaN(value)) return false;
  const [min, max] = bounds;
  return value < min || value > max;
}
