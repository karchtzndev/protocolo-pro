import type { AnthropometryRecord, Patient } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { calculateEnergyEquations, ACTIVITY_LEVEL_LABELS, type Sex, type ActivityLevel } from "@/lib/health/energyEquations";
import { calculateSkinfoldProtocols } from "@/lib/health/skinfolds";
import { calculateIndices } from "@/lib/health/indices";
import { AnthropometryDialog } from "./AnthropometryDialog";

export function ComposicaoTab({ patient, records }: { patient: Patient; records: AnthropometryRecord[] }) {
  const latest = records[0];
  const sex: Sex = patient.sex === "masculino" ? "masculino" : "feminino";
  const age = yearsSince(patient.birth_date);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <AnthropometryDialog patientId={patient.id} />
      </div>

      {!latest ? (
        <p className="rounded-lg border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--ink-soft)]">
          Nenhuma aferição registrada ainda.
        </p>
      ) : (
        <>
          <IndicesSection latest={latest} sex={patient.sex} />
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
