import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { SupplementDocument } from "@/lib/pdf/SupplementDocument";
import type { Patient, PatientSupplement, Nutritionist } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = createServiceRoleClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*, nutritionist:nutritionists(*)")
    .eq("id", patientId)
    .single<Patient & { nutritionist: Nutritionist }>();

  if (!patient) return new Response("Paciente não encontrado.", { status: 404 });

  const { data: supplements } = await supabase
    .from("patient_supplements")
    .select("*, supplement:supplements_catalog(*)")
    .eq("patient_id", patientId)
    .returns<PatientSupplement[]>();

  try {
    const buffer = await renderToBuffer(
      <SupplementDocument patient={patient} supplements={supplements ?? []} nutritionist={patient.nutritionist} />
    );

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="suplementacao-${patient.full_name.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
      },
    });
  } catch (err) {
    console.error("Falha ao gerar PDF de suplementação:", err);
    return new Response(`Falha ao gerar PDF: ${err instanceof Error ? err.stack ?? err.message : String(err)}`, {
      status: 500,
    });
  }
}
