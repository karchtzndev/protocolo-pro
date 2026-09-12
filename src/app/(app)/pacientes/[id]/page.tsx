import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import { Tabs } from "@/components/ui/Tabs";
import type { Patient, Protocol, PatientSupplement, Exam, ExamResult, AnthropometryRecord, FoodCatalogItem, SupplementCatalogItem, SupplementPreset, Appointment, AnamnesisResponse, CompoundedFormula } from "@/lib/types";
import { CadastroTab } from "./CadastroTab";
import { ProtocoloTab } from "./ProtocoloTab";
import { ComposicaoTab } from "./ComposicaoTab";
import { SuplementacaoTab } from "./SuplementacaoTab";
import { ExamesTab } from "./ExamesTab";
import { AgendamentosTab } from "./AgendamentosTab";

const statusTone = { ativo: "success", pendente: "warning", inativo: "neutral" } as const;

export default async function FichaPacientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: patient } = await supabase.from("patients").select("*").eq("id", id).single<Patient>();
  if (!patient) notFound();

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("enabled_modules")
    .eq("id", patient.nutritionist_id)
    .single();
  const enabledModules = nutritionist?.enabled_modules ?? [];

  const [{ data: protocol }, { data: patientSupplements }, { data: catalog }, { data: exams }, { data: anthropometry }, { data: foods }, { data: presets }, { data: protocolHistory }, { data: appointments }, { data: anamnesisResponses }, { data: formulas }] = await Promise.all([
    supabase
      .from("protocols")
      .select("*")
      .eq("patient_id", id)
      .eq("active", true)
      .maybeSingle<Protocol>(),
    supabase
      .from("patient_supplements")
      .select("*, supplement:supplements_catalog(*)")
      .eq("patient_id", id)
      .returns<PatientSupplement[]>(),
    supabase.from("supplements_catalog").select("*").order("name").returns<SupplementCatalogItem[]>(),
    supabase
      .from("exams")
      .select("*, results:exam_results(*)")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .returns<(Exam & { results: ExamResult[] })[]>(),
    supabase
      .from("anthropometry_records")
      .select("*")
      .eq("patient_id", id)
      .order("recorded_at", { ascending: false })
      .returns<AnthropometryRecord[]>(),
    supabase.from("foods_catalog").select("*").returns<FoodCatalogItem[]>(),
    supabase.from("supplement_presets").select("*").order("name").returns<SupplementPreset[]>(),
    supabase
      .from("protocols")
      .select("*")
      .eq("patient_id", id)
      .eq("active", false)
      .order("created_at", { ascending: false })
      .returns<Protocol[]>(),
    supabase
      .from("appointments")
      .select("*")
      .eq("patient_id", id)
      .order("scheduled_at", { ascending: false })
      .returns<Appointment[]>(),
    supabase
      .from("anamnesis_responses")
      .select("*")
      .eq("patient_id", id)
      .returns<AnamnesisResponse[]>(),
    supabase
      .from("compounded_formulas")
      .select("*")
      .eq("patient_id", id)
      .order("created_at", { ascending: false })
      .returns<CompoundedFormula[]>(),
  ]);

  const age = yearsSince(patient.birth_date);

  const latestFilledAnamnesis = (anamnesisResponses ?? [])
    .filter((a) => a.status === "preenchido")
    .sort((a, b) => new Date(b.submitted_at ?? b.created_at).getTime() - new Date(a.submitted_at ?? a.created_at).getTime())[0];
  const excludedFoodIds = new Set(latestFilledAnamnesis?.responses.alimentos_intolerancia ?? []);
  const safeFoods = (foods ?? []).filter((f) => !excludedFoodIds.has(f.id));
  const excludedFoodNames = (foods ?? []).filter((f) => excludedFoodIds.has(f.id)).map((f) => f.name);
  const preferredFoodIds = (latestFilledAnamnesis?.responses.alimentos_habituais ?? []).filter(
    (id) => !excludedFoodIds.has(id)
  );

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-3.5">
        <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-accent-soft font-display text-lg font-bold text-accent-strong">
          {initials(patient.full_name)}
        </div>
        <div>
          <h1 className="text-2xl font-bold">{patient.full_name}</h1>
          <p className="mt-0.5 flex items-center gap-2 text-sm text-[var(--ink-soft)]">
            {age} anos
            {patient.objective && <Badge tone="neutral">{patient.objective}</Badge>}
            <Badge tone={statusTone[patient.status]}>{patient.status}</Badge>
          </p>
        </div>
      </div>

      <div className="mt-6">
        <Tabs
          tabs={[
            { id: "cadastro", label: "Cadastro Clínico", content: <CadastroTab patient={patient} enabledModules={enabledModules} /> },
            { id: "composicao", label: "Composição Corporal", content: <ComposicaoTab patient={patient} records={anthropometry ?? []} /> },
            {
              id: "protocolo",
              label: "Protocolo Alimentar",
              content: (
                <ProtocoloTab
                  patient={patient}
                  protocol={protocol}
                  foods={safeFoods}
                  latestAnthropometry={anthropometry?.[0] ?? null}
                  history={protocolHistory ?? []}
                  preferredFoodIds={preferredFoodIds}
                  excludedFoodNames={excludedFoodNames}
                  enabledModules={enabledModules}
                />
              ),
            },
            {
              id: "supp",
              label: "Suplementação",
              content: (
                <SuplementacaoTab
                  patient={patient}
                  patientId={patient.id}
                  prescribed={patientSupplements ?? []}
                  catalog={catalog ?? []}
                  presets={presets ?? []}
                  formulas={formulas ?? []}
                  formulasEnabled={enabledModules.includes("clinico")}
                />
              ),
            },
            { id: "exames", label: "Exames", content: <ExamesTab patientId={patient.id} exams={exams ?? []} presets={presets ?? []} /> },
            {
              id: "agendamentos",
              label: "Agendamentos",
              content: (
                <AgendamentosTab
                  patientId={patient.id}
                  appointments={appointments ?? []}
                  anamnesisByAppointment={Object.fromEntries(
                    (anamnesisResponses ?? [])
                      .filter((a) => a.appointment_id)
                      .map((a) => [a.appointment_id as string, a])
                  )}
                />
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

function yearsSince(dateStr: string) {
  const birth = new Date(dateStr);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
