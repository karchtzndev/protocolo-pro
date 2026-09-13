import type { AnthropometryRecord, Patient } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { calculateEnergyEquations, ACTIVITY_LEVEL_LABELS, type Sex, type ActivityLevel } from "@/lib/health/energyEquations";
import { calculateSkinfoldProtocols } from "@/lib/health/skinfolds";
import { calculateIndices } from "@/lib/health/indices";
import { AnthropometryDialog } from "./AnthropometryDialog";
import { EvolutionChart, type EvolutionPoint } from "@/components/charts/EvolutionChart";

export function ComposicaoTab({ patient, records }: { patient: Patient; records: AnthropometryRecord[] }) {
  const latest = records[0];
  const sex: Sex = patient.sex === "masculino" ? "masculino" : "feminino";
  const age = yearsSince(patient.birth_date);

  return (
    <div>
      <div className="mb-4 flex justify-end gap-2">
        {records.length > 0 && (
          <a href={`/api/pdf/composicao/${patient.id}`} target="_blank" rel="noreferrer">
            <Button variant="accent">⭳ Gerar PDF de composição corporal</Button>
          </a>
        )}
        <AnthropometryDialog patientId={patient.id} />
      </div>

      {!latest ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--ink-soft)]">
          Nenhuma aferição registrada ainda.
        </p>
      ) : (
        <>
          <IndicesSection latest={latest} sex={patient.sex} />
          <EvolutionSection records={records} sex={sex} age={age} />
          <EnergySection latest={latest} sex={sex} age={age} />
          <SkinfoldsSection latest={latest} sex={sex} age={age} />
        </>
      )}

      <h3 className="mb-3 mt-6 text-sm font-semibold">Histórico de aferições</h3>
      <div className="overflow-x-auto rounded-xl border border-[var(--border-soft)]">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              {["Data", "Peso", "Altura", "Cintura", "Quadril", "Atividade"].map((h) => (
                <th key={h} className="whitespace-nowrap bg-[var(--surface-2)] px-3 py-2.5 text-left font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td className="border-t border-[var(--border-soft)] px-3 py-2.5">{new Date(r.recorded_at).toLocaleDateString("pt-BR")}</td>
                <td className="border-t border-[var(--border-soft)] px-3 py-2.5">{r.weight_kg} kg</td>
                <td className="border-t border-[var(--border-soft)] px-3 py-2.5">{r.height_m} m</td>
                <td className="border-t border-[var(--border-soft)] px-3 py-2.5">{r.waist_cm ? `${r.waist_cm} cm` : "—"}</td>
                <td className="border-t border-[var(--border-soft)] px-3 py-2.5">{r.hip_cm ? `${r.hip_cm} cm` : "—"}</td>
                <td className="border-t border-[var(--border-soft)] px-3 py-2.5">{ACTIVITY_LEVEL_LABELS[r.activity_level as ActivityLevel]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Cada métrica em seu próprio gráfico (small multiples): peso, gordura e
 * cintura têm escalas incompatíveis, e um eixo duplo inventaria correlação.
 */
function EvolutionSection({ records, sex, age }: { records: AnthropometryRecord[]; sex: Sex; age: number }) {
  // `records` chega do mais recente pro mais antigo; o gráfico lê da esquerda (passado) pra direita.
  const chronological = [...records].reverse();
  const label = (r: AnthropometryRecord) =>
    new Date(r.recorded_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });

  const weight: EvolutionPoint[] = chronological.map((r) => ({ date: label(r), value: r.weight_kg }));
  const waist: EvolutionPoint[] = chronological
    .filter((r) => r.waist_cm != null)
    .map((r) => ({ date: label(r), value: r.waist_cm as number }));
  const bodyFat: EvolutionPoint[] = chronological
    .map((r) => {
      const best = calculateSkinfoldProtocols({
        sex,
        ageYears: age,
        chest: r.skinfold_chest_mm,
        midaxillary: r.skinfold_midaxillary_mm,
        triceps: r.skinfold_triceps_mm,
        subscapular: r.skinfold_subscapular_mm,
        abdominal: r.skinfold_abdominal_mm,
        suprailiac: r.skinfold_suprailiac_mm,
        thigh: r.skinfold_thigh_mm,
        bicep: r.skinfold_bicep_mm,
      }).find((p) => p.available);
      return best?.bodyFatPct != null ? { date: label(r), value: best.bodyFatPct } : null;
    })
    .filter((p): p is EvolutionPoint => p !== null);

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold">Evolução</h3>
      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3">
        <EvolutionChart title="Peso" unit="kg" points={weight} />
        <EvolutionChart title="Gordura corporal" unit="%" points={bodyFat} />
        <EvolutionChart title="Cintura" unit="cm" points={waist} />
      </div>
    </div>
  );
}

function IndicesSection({ latest, sex }: { latest: AnthropometryRecord; sex: Patient["sex"] }) {
  const indices = calculateIndices({
    weightKg: latest.weight_kg,
    heightM: latest.height_m,
    waistCm: latest.waist_cm,
    hipCm: latest.hip_cm,
    sex,
  });

  return (
    <div className="mb-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
      <IndexTile label="IMC" value={indices.imc} suffix="" classification={indices.imcClassification} />
      <IndexTile label="Relação cintura-quadril (RCQ)" value={indices.rcq} suffix="" classification={indices.rcqRisk} />
      <IndexTile label="Relação cintura-estatura (RCE)" value={indices.rce} suffix="" classification={indices.rceRisk} />
    </div>
  );
}

function IndexTile({ label, value, suffix, classification }: { label: string; value: number | null; suffix: string; classification: string | null }) {
  return (
    <div className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3.5">
      <div className="text-[10px] uppercase tracking-wide text-[var(--ink-soft)]">{label}</div>
      <div className="mt-1 font-mono-data text-lg font-semibold">{value !== null ? `${value}${suffix}` : "—"}</div>
      {classification && <div className="mt-1 text-xs text-[var(--ink-soft)]">{classification}</div>}
    </div>
  );
}

function EnergySection({ latest, sex, age }: { latest: AnthropometryRecord; sex: Sex; age: number }) {
  const results = calculateEnergyEquations({
    sex,
    ageYears: age,
    weightKg: latest.weight_kg,
    heightCm: latest.height_m * 100,
    leanMassKg: latest.lean_mass_kg,
    activityLevel: latest.activity_level,
  });

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold">Gasto energético — comparação entre fórmulas</h3>
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {results.map((r) => (
          <div key={r.key} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3.5">
            <div className="text-xs font-semibold">{r.label}</div>
            {r.available ? (
              <>
                <div className="mt-1 font-mono-data text-lg font-semibold text-accent-strong">{r.tdeeKcal} kcal</div>
                <div className="text-[11px] text-[var(--ink-soft)]">TMB: {r.bmrKcal} kcal</div>
              </>
            ) : (
              <div className="mt-1 text-xs text-[var(--ink-faint)]">{r.unavailableReason}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function SkinfoldsSection({ latest, sex, age }: { latest: AnthropometryRecord; sex: Sex; age: number }) {
  const results = calculateSkinfoldProtocols({
    sex,
    ageYears: age,
    chest: latest.skinfold_chest_mm,
    midaxillary: latest.skinfold_midaxillary_mm,
    triceps: latest.skinfold_triceps_mm,
    subscapular: latest.skinfold_subscapular_mm,
    abdominal: latest.skinfold_abdominal_mm,
    suprailiac: latest.skinfold_suprailiac_mm,
    thigh: latest.skinfold_thigh_mm,
    bicep: latest.skinfold_bicep_mm,
  });

  const anyAvailable = results.some((r) => r.available);

  return (
    <div className="mb-2">
      <h3 className="mb-3 text-sm font-semibold">Dobras cutâneas — % de gordura estimado</h3>
      {!anyAvailable ? (
        <p className="text-sm text-[var(--ink-soft)]">Registre as dobras cutâneas na aferição para calcular.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {results.map((r) => (
            <div key={r.key} className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3.5">
              <div className="text-xs font-semibold">{r.label}</div>
              {r.available ? (
                <div className="mt-1 font-mono-data text-lg font-semibold text-accent-strong">{r.bodyFatPct}% gordura</div>
              ) : (
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge tone="neutral">faltam: {r.missingFields?.join(", ")}</Badge>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function yearsSince(dateStr: string) {
  const birth = new Date(dateStr);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
  return age;
}
