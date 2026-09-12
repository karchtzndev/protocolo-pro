import type {
  Patient,
  Nutritionist,
  Protocol,
  PatientSupplement,
  AnamnesisResponse,
  FoodCatalogItem,
  SubscriptionPlan,
  PatientSubscription,
} from "@/lib/types";
import { MEAL_SCHEDULE } from "@/lib/types";
import { ShareButtons } from "./ShareButtons";
import { AnamnesisForm } from "./AnamnesisForm";
import { PlanSubscriptionCard } from "./PlanSubscriptionCard";

const DAY_KEYS: (keyof NonNullable<Protocol["weekly_menu"]>)[] = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];

export function PatientOverview({
  patient,
  nutritionist,
  protocol,
  supplements,
  slug,
  pendingAnamnesis,
  foods,
  plans,
  subscription,
}: {
  patient: Patient;
  nutritionist: Nutritionist;
  protocol: Protocol | null;
  supplements: PatientSupplement[];
  slug: string;
  pendingAnamnesis: AnamnesisResponse | null;
  foods: FoodCatalogItem[];
  plans: SubscriptionPlan[];
  subscription: PatientSubscription | null;
}) {
  const todayKey = DAY_KEYS[new Date().getDay()];
  const todayMenu = protocol?.weekly_menu[todayKey] ?? {};
  const todayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long" }).format(
    new Date()
  );
  const clinicName = nutritionist.clinic_name ?? nutritionist.full_name;

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <div
        className="px-6 pb-16 pt-7 text-white"
        style={{ background: `linear-gradient(160deg, ${nutritionist.brand_primary_color}, #10231d)` }}
      >
        <div className="mb-5 flex items-center gap-2.5">
          {nutritionist.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={nutritionist.logo_url} alt={clinicName} className="h-[38px] w-[38px] rounded-lg object-cover" />
          ) : (
            <div className="flex h-[38px] w-[38px] items-center justify-center rounded-lg bg-white/15 font-display text-sm font-bold">
              {clinicName[0]}
            </div>
          )}
          <div>
            <b className="block text-[13.5px]">{clinicName}</b>
            <span className="block text-[11px] opacity-70">{nutritionist.clinic_phone}</span>
          </div>
        </div>
        <h1 className="mb-1 text-xl font-bold">Olá, {patient.full_name.split(" ")[0]} 👋</h1>
        <p className="text-sm capitalize opacity-75">Seu protocolo de hoje — {todayLabel}</p>
      </div>

      <div className="-mt-9 space-y-3.5 px-4 pb-32">
        {pendingAnamnesis && <AnamnesisForm anamnesisId={pendingAnamnesis.id} slug={slug} foods={foods} />}

        <Card title="🍽 Refeições de hoje">
          {MEAL_SCHEDULE.map(({ key: mealKey, label, time }) => {
            const meal = todayMenu[mealKey];
            if (!meal) return null;
            return (
              <div key={mealKey} className="flex gap-3 border-b border-[var(--border-soft)] py-2.5 last:border-none">
                <div className="w-11 shrink-0 pt-0.5 font-mono-data text-[11px] text-[var(--ink-faint)]">
                  {time}
                </div>
                <div>
                  <b className="block text-[13.5px]">{label}</b>
                  <span className="text-xs text-[var(--ink-soft)]">{meal.descricao}</span>
                  <div className="mt-1.5 flex gap-1.5">
                    <Macro tone="accent">{meal.kcal} kcal</Macro>
                    {meal.proteina_g && <Macro tone="success">P {meal.proteina_g}g</Macro>}
                    {meal.carboidrato_g && <Macro tone="neutral">C {meal.carboidrato_g}g</Macro>}
                    {meal.gordura_g && <Macro tone="warning">G {meal.gordura_g}g</Macro>}
                  </div>
                </div>
              </div>
            );
          })}
          {!protocol && (
            <p className="py-3 text-sm text-[var(--ink-soft)]">Seu protocolo ainda está sendo preparado.</p>
          )}
        </Card>

        {supplements.length > 0 && (
          <Card title="💊 Suplementação">
            {supplements.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-dashed border-[var(--border-soft)] py-2 text-sm last:border-none">
                <span>
                  {s.supplement?.name} — {s.dose}
                  {s.dose_unit}
                </span>
                <span className="font-mono-data text-[11.5px] font-bold text-brand">{s.schedule}</span>
              </div>
            ))}
          </Card>
        )}

        {(plans.length > 0 || subscription) && (
          <PlanSubscriptionCard slug={slug} plans={plans} subscription={subscription} />
        )}

        {protocol?.guidance && protocol.guidance.length > 0 && (
          <Card title="💧 Orientações">
            {protocol.guidance.map((g) => (
              <p key={g} className="py-1 text-sm text-[var(--ink-soft)]">
                • {g}
              </p>
            ))}
          </Card>
        )}
      </div>

      <ShareButtons patientName={patient.full_name} patientId={patient.id} clinicName={clinicName} />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[0_8px_30px_rgba(27,33,29,.1)]">
      <h4 className="mb-2.5 text-[13.5px] font-semibold">{title}</h4>
      {children}
    </div>
  );
}

function Macro({ tone, children }: { tone: "accent" | "success" | "neutral" | "warning"; children: React.ReactNode }) {
  const toneClass = {
    accent: "bg-accent-soft text-accent-strong",
    success: "bg-success-soft text-success",
    neutral: "bg-[var(--surface-2)] text-[var(--ink-soft)]",
    warning: "bg-warning-soft text-warning",
  }[tone];
  return (
    <span className={`rounded-full px-2 py-0.5 font-mono-data text-[10.5px] font-bold ${toneClass}`}>{children}</span>
  );
}
