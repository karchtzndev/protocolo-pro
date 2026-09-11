import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

/** Exportação de todos os dados do titular, a pedido — LGPD art. 18. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const { data: nutritionist } = await supabase.from("nutritionists").select("*").eq("id", user.id).single();
  const { data: patients } = await supabase.from("patients").select("*").eq("nutritionist_id", user.id);

  const patientIds = (patients ?? []).map((p) => p.id);

  const [{ data: protocols }, { data: anthropometry }, { data: supplements }, { data: exams }, { data: links }] = await Promise.all([
    patientIds.length ? supabase.from("protocols").select("*").in("patient_id", patientIds) : { data: [] },
    patientIds.length ? supabase.from("anthropometry_records").select("*").in("patient_id", patientIds) : { data: [] },
    patientIds.length ? supabase.from("patient_supplements").select("*").in("patient_id", patientIds) : { data: [] },
    patientIds.length ? supabase.from("exams").select("*, results:exam_results(*)").in("patient_id", patientIds) : { data: [] },
    patientIds.length ? supabase.from("patient_links").select("*").in("patient_id", patientIds) : { data: [] },
  ]);

  await logAudit(user.id, "dados.exportar", { targetType: "nutritionist", targetId: user.id });

  const payload = {
    exported_at: new Date().toISOString(),
    nutritionist,
    patients,
    protocols,
    anthropometry_records: anthropometry,
    patient_supplements: supplements,
    exams,
    patient_links: links,
  };

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="protocolo-pro-dados-${user.id}.json"`,
    },
  });
}
