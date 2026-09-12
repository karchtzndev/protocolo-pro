import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { AnthropometryDocument } from "@/lib/pdf/AnthropometryDocument";
import type { Patient, Nutritionist, AnthropometryRecord } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = createServiceRoleClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*, nutritionist:nutritionists(*)")
    .eq("id", patientId)
    .single<Patient & { nutritionist: Nutritionist }>();

  if (!patient) return new Response("Paciente não encontrado.", { status: 404 });

  const { data: records } = await supabase
    .from("anthropometry_records")
    .select("*")
    .eq("patient_id", patientId)
    .order("recorded_at", { ascending: false })
    .returns<AnthropometryRecord[]>();

  if (!records?.length) return new Response("Nenhuma aferição registrada para este paciente.", { status: 404 });

  try {
    const buffer = await renderToBuffer(
      <AnthropometryDocument patient={patient} nutritionist={patient.nutritionist} records={records} />
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="composicao-${patient.full_name.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Falha ao gerar PDF de composição corporal:", err);
    return new Response(`Falha ao gerar PDF: ${err instanceof Error ? err.stack ?? err.message : String(err)}`, {
      status: 500,
    });
  }
}
