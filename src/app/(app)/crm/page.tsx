import { createClient } from "@/lib/supabase/server";
import { screenPatient } from "@/lib/clinicalScreening";
import type { CrmStage, MealCheckin, Patient } from "@/lib/types";
import { evaluateEngagement } from "@/lib/engagement";
import { PatientCard } from "./PatientCard";
import { CopyLinkButton } from "../links/CopyLinkButton";
import { ensureBookingSlug } from "./actions";

export default async function CrmPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: stages }, { data: patients }, { data: nutritionist }, { data: recentCheckins }] = await Promise.all([
    supabase.from("crm_stages").select("*").order("position").returns<CrmStage[]>(),
    supabase.from("patients").select("*").neq("status", "inativo").returns<Patient[]>(),
    supabase.from("nutritionists").select("booking_slug").eq("id", user?.id ?? "").single(),
    supabase
      .from("meal_checkins")
      .select("*")
      .gte("checkin_date", new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10))
      .returns<MealCheckin[]>(),
  ]);

  const checkinsByPatient = new Map<string, MealCheckin[]>();
  for (const c of recentCheckins ?? []) {
    checkinsByPatient.set(c.patient_id, [...(checkinsByPatient.get(c.patient_id) ?? []), c]);
  }

  let bookingSlug = nutritionist?.booking_slug ?? null;
  if (!bookingSlug) bookingSlug = await ensureBookingSlug();

  const captureUrl = `${process.env.NEXT_PUBLIC_APP_URL}/captar/${bookingSlug}`;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">CRM — Funil de pacientes</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">Arraste conceitualmente movendo o estágio de cada card.</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2">
          <code className="font-mono-data text-xs text-[var(--ink-soft)]">/captar/{bookingSlug}</code>
          <CopyLinkButton url={captureUrl} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stages?.map((stage) => {
          const stagePatients = (patients ?? []).filter((p) => p.stage_id === stage.id);
          return (
            <div key={stage.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-[13px] font-bold">{stage.label}</h2>
                <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[11px] font-bold text-[var(--ink-soft)]">
                  {stagePatients.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {stagePatients.length ? (
                  stagePatients.map((p) => (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      stages={stages ?? []}
                      flagged={screenPatient(p).flagged}
                      churnReason={evaluateEngagement(p, checkinsByPatient.get(p.id) ?? []).reason}
                    />
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--border)] p-3 text-center text-[11px] text-[var(--ink-faint)]">
                    Vazio
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
