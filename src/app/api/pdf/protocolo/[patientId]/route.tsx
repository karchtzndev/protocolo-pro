import { renderToBuffer } from "@react-pdf/renderer";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ProtocolDocument } from "@/lib/pdf/ProtocolDocument";
import type { Patient, Protocol, Nutritionist, FoodCatalogItem } from "@/lib/types";

export async function GET(_request: Request, { params }: { params: Promise<{ patientId: string }> }) {
  const { patientId } = await params;
  const supabase = createServiceRoleClient();

  const { data: patient } = await supabase
    .from("patients")
    .select("*, nutritionist:nutritionists(*)")
    .eq("id", patientId)
    .single<Patient & { nutritionist: Nutritionist }>();

  if (!patient) return new Response("Paciente não encontrado.", { status: 404 });

  const { data: protocol } = await supabase
    .from("protocols")
    .select("*")
    .eq("patient_id", patientId)
    .eq("active", true)
    .maybeSingle<Protocol>();

  const { data: foods } = await supabase.from("foods_catalog").select("*").returns<FoodCatalogItem[]>();

  const buffer = await renderToBuffer(
    <ProtocolDocument patient={patient} protocol={protocol} nutritionist={patient.nutritionist} foods={foods ?? []} />
  );

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="protocolo-${patient.full_name.replace(/\s+/g, "-").toLowerCase()}.pdf"`,
    },
  });
}
