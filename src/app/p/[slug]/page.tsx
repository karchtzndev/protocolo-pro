import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type {
  Patient,
  PatientLink,
  Protocol,
  PatientSupplement,
  Nutritionist,
  AnamnesisResponse,
  FoodCatalogItem,
  SubscriptionPlan,
  PatientSubscription,
  MealCheckin,
  Recipe,
} from "@/lib/types";
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

  const [
    { data: protocol },
    { data: supplements },
    { data: pendingAnamnesis },
    { data: foods },
    { data: plans },
    { data: subscription },
    { data: todayCheckins },
    { data: recipes },
  ] = await Promise.all([
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
      supabase
        .from("subscription_plans")
        .select("*")
        .eq("nutritionist_id", link.patient.nutritionist.id)
        .eq("active", true)
        .returns<SubscriptionPlan[]>(),
      supabase
        .from("patient_subscriptions")
        .select("*, plan:subscription_plans(*)")
        .eq("patient_id", link.patient.id)
        .in("status", ["trialing", "active", "past_due"])
        .maybeSingle<PatientSubscription>(),
      supabase
        .from("meal_checkins")
        .select("*")
        .eq("patient_id", link.patient.id)
        .eq("checkin_date", new Date().toISOString().slice(0, 10))
        .returns<MealCheckin[]>(),
      supabase
        .from("recipes")
        .select("*")
        .eq("nutritionist_id", link.patient.nutritionist.id)
        .returns<Recipe[]>(),
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
      plans={plans ?? []}
      subscription={subscription}
      todayCheckins={todayCheckins ?? []}
      recipes={recipes ?? []}
    />
  );
}
