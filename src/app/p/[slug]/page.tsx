import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Patient, PatientLink, Protocol, PatientSupplement, Nutritionist, AnamnesisResponse, FoodCatalogItem } from "@/lib/types";
import { PatientGate } from "./PatientGate";
import { PatientOverview } from "./PatientOverview";

export default async function PublicPatientPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();

  const { data: link } = await supabase
    .from("patient_links")
    .select("*, patient:patients(*, nutritionist:nutritionists(*))")
    .eq("slug", slug)
    .single<PatientLink & { patient: Patient & { nutritionist: Nutritionist } }>();

  if (!link || link.revoked_at) notFound();
  if (link.expires_at && new Date(link.expires_at) < new Date()) notFound();

  const cookieStore = await cookies();
  const hasAccess = cookieStore.get(`pl_${slug}`)?.value === "granted";

  if (!hasAccess) {
    return (
      <PatientGate
        slug={slug}
        patientFirstName={link.patient.full_name.split(" ")[0]}
        clinicName={link.patient.nutritionist.clinic_name ?? link.patient.nutritionist.full_name}
        alreadyConsented={!!link.consent_accepted_at}
      />
    );
  }

  const [{ data: protocol }, { data: supplements }, { data: pendingAnamnesis }, { data: foods }] = await Promise.all([
    supabase
      .from("protocols")
      .select("*")
      .eq("patient_id", link.patient.id)
      .eq("active", true)
      .maybeSingle<Protocol>(),
    supabase
      .from("patient_supplements")
      .select("*, supplement:supplements_catalog(*)")
      .eq("patient_id", link.patient.id)
      .returns<PatientSupplement[]>(),
    supabase
      .from("anamnesis_responses")
      .select("*")
      .eq("patient_id", link.patient.id)
      .eq("status", "pendente")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<AnamnesisResponse>(),
    supabase.from("foods_catalog").select("*").returns<FoodCatalogItem[]>(),
  ]);

  return (
    <PatientOverview
      patient={link.patient}
      nutritionist={link.patient.nutritionist}
      protocol={protocol}
      supplements={supplements ?? []}
      slug={slug}
      pendingAnamnesis={pendingAnamnesis}
      foods={foods ?? []}
    />
  );
}
