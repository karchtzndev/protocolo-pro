"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { AnthropometryRecord, DayMenu, FoodCatalogItem, Patient, Protocol, WeeklyMenu } from "@/lib/types";
import { MEAL_SCHEDULE } from "@/lib/types";
import { MEAL_PRESET_LIST, type MealPresetKey } from "@/lib/mealPresets";
import { calculateEnergyEquations } from "@/lib/health/energyEquations";
import { generateWeeklyMenu, SafeCalorieFloorError, type DietObjective } from "@/lib/diet/generateProtocol";
import { buildShoppingListFromMenu } from "@/lib/diet/shoppingList";
import { saveProtocol } from "./protocol-actions";

const DAYS: { key: keyof WeeklyMenu; label: string }[] = [
  { key: "seg", label: "Seg" },
  { key: "ter", label: "Ter" },
  { key: "qua", label: "Qua" },
  { key: "qui", label: "Qui" },
  { key: "sex", label: "Sex" },
  { key: "sab", label: "Sáb" },
  { key: "dom", label: "Dom" },
];

const MEALS = MEAL_SCHEDULE;

export function ProtocolEditorDialog({
  patient,
  protocol,
  foods,
  latestAnthropometry,
}: {
  patient: Patient;
  protocol: Protocol | null;
  foods: FoodCatalogItem[];
  latestAnthropometry: AnthropometryRecord | null;
}) {
  const [open, setOpen] = useState(false);
  const [weeklyMenu, setWeeklyMenu] = useState<WeeklyMenu>(protocol?.weekly_menu ?? {});
  const [shoppingList, setShoppingList] = useState((protocol?.shopping_list ?? []).join("\n"));
  const [guidance, setGuidance] = useState((protocol?.guidance ?? []).join("\n"));
  const [activePreset, setActivePreset] = useState<MealPresetKey | null>(null);
  const [objective, setObjective] = useState<DietObjective>("manutencao");
  const [isDraft, setIsDraft] = useState(protocol?.is_draft ?? true);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationSummary, setGenerationSummary] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  function applyPreset(key: MealPresetKey) {
    const preset = MEAL_PRESET_LIST.find((p) => p.key === key);
    if (!preset) return;
    setWeeklyMenu(preset.weekly_menu);
    setShoppingList(preset.shopping_list.join("\n"));
    setGuidance(preset.guidance.join("\n"));
    setActivePreset(key);
    setGenerationError(null);
    setGenerationSummary(null);
  }

  function generateAutomatically() {
    setGenerationError(null);
    setGenerationSummary(null);

    if (!latestAnthropometry) {
      setGenerationError("Registre uma aferição na aba Composição Corporal antes de gerar automaticamente.");
      return;
    }
    if (!foods.length) {
      setGenerationError("Catálogo de alimentos vazio — rode a migração 0004_foods_catalog.sql no Supabase.");
      return;
    }

    const sex = patient.sex === "masculino" ? "masculino" : "feminino";
    const age = yearsSince(patient.birth_date);
    const [mifflin] = calculateEnergyEquations({
      sex,
      ageYears: age,
      weightKg: latestAnthropometry.weight_kg,
      heightCm: latestAnthropometry.height_m * 100,
      leanMassKg: latestAnthropometry.lean_mass_kg,
      activityLevel: latestAnthropometry.activity_level,
    });

    try {
      const result = generateWeeklyMenu({
        sex,
        tdeeKcal: mifflin.tdeeKcal as number,
        weightKg: latestAnthropometry.weight_kg,
        objective,
        foods,
      });
      setWeeklyMenu(result.weekly_menu);
      setActivePreset(null);
      setGenerationSummary(
        `Gerado com base em ${mifflin.tdeeKcal} kcal de gasto (Mifflin-St Jeor) — meta de ${result.target_kcal_per_day} kcal/dia · ${result.macro_targets.protein_g}g proteína · ${result.macro_targets.carb_g}g carboidrato · ${result.macro_targets.fat_g}g gordura.`
      );
    } catch (err) {
      setGenerationError(err instanceof SafeCalorieFloorError ? err.message : "Não foi possível gerar o protocolo.");
    }
  }

  function updateSlot(day: keyof WeeklyMenu, meal: keyof DayMenu, field: "descricao" | "kcal", value: string) {
    setWeeklyMenu((prev) => {
      const daySlots = prev[day] ?? {};
      const slot = daySlots[meal] ?? { descricao: "", kcal: 0 };
      return {
        ...prev,
        [day]: {
          ...daySlots,
          [meal]: {
            ...slot,
            [field]: field === "kcal" ? Number(value) || 0 : value,
          },
        },
      };
    });
  }

  function substituteFood(day: keyof WeeklyMenu, meal: keyof DayMenu, foodId: string) {
    const food = foods.find((f) => f.id === foodId);
    if (!food) return;

    setWeeklyMenu((prev) => {
      const daySlots = prev[day] ?? {};
      const slot = daySlots[meal];
      const targetKcal = slot?.kcal && slot.kcal > 0 ? slot.kcal : food.kcal_100g * (food.usual_portion_g / 100);
      const grams = Math.max(5, Math.round(((targetKcal / food.kcal_100g) * 100) / 5) * 5);

      return {
        ...prev,
        [day]: {
          ...daySlots,
          [meal]: {
            descricao: `${food.name} (${grams} g)`,
            kcal: Math.round((food.kcal_100g * grams) / 100),
            proteina_g: Math.round((food.protein_100g * grams) / 100),
            carboidrato_g: Math.round((food.carb_100g * grams) / 100),
            gordura_g: Math.round((food.fat_100g * grams) / 100),
          },
        },
      };
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>{protocol ? "Editar protocolo" : "Criar protocolo"}</Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <form
            ref={formRef}
            onClick={(e) => e.stopPropagation()}
            action={async (formData) => {
              formData.set("weekly_menu", JSON.stringify(weeklyMenu));
              formData.set("shopping_list", shoppingList);
              formData.set("guidance", guidance);
              await saveProtocol(patient.id, formData);
              setOpen(false);
            }}
            className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-2xl"
          >
            <h2 className="mb-1 text-lg font-bold">{protocol ? "Editar protocolo" : "Criar protocolo"}</h2>
            <p className="mb-4 text-sm text-[var(--ink-soft)]">{patient.full_name}</p>

            <FieldLabel>Modelo predefinido</FieldLabel>
            <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MEAL_PRESET_LIST.map((preset) => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-xs transition ${
                    activePreset === preset.key
                      ? "border-brand bg-accent-soft"
                      : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--ink-faint)]"
                  }`}
                >
                  <span className="block font-bold">{preset.label}</span>
                  <span className="mt-0.5 block text-[10.5px] text-[var(--ink-soft)]">{preset.description}</span>
                </button>
              ))}
            </div>

            <div className="mb-5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] p-3.5">
              <FieldLabel>Gerar automaticamente a partir da composição corporal</FieldLabel>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={objective}
                  onChange={(e) => setObjective(e.target.value as DietObjective)}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
                >
                  <option value="emagrecimento">Emagrecimento</option>
                  <option value="manutencao">Manutenção</option>
                  <option value="hipertrofia">Hipertrofia</option>
                </select>
                <Button type="button" variant="ghost" onClick={generateAutomatically}>
                  ⚡ Gerar 7 dias
                </Button>
              </div>
              {generationSummary && <p className="mt-2 text-xs text-success">{generationSummary}</p>}
              {generationError && <p className="mt-2 text-xs text-danger">{generationError}</p>}
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="Peso (kg)" name="weight_kg" defaultValue={protocol?.weight_kg ?? undefined} />
              <NumField
                label="Altura (m)"
                name="height_m"
                step="0.01"
                placeholder="ex: 1,75"
                defaultValue={protocol?.height_m ?? undefined}
              />
              <NumField label="Gordura (%)" name="body_fat_pct" defaultValue={protocol?.body_fat_pct ?? undefined} />
              <NumField label="Cintura (cm)" name="waist_cm" defaultValue={protocol?.waist_cm ?? undefined} />
            </div>

            <FieldLabel>Cardápio — 7 dias</FieldLabel>
            <div className="mb-5 overflow-x-auto rounded-xl border border-[var(--border-soft)]">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr>
                    <th className="sticky left-0 whitespace-nowrap bg-[var(--surface-2)] px-2 py-2 text-left font-bold uppercase tracking-wide text-[var(--ink-soft)]">
                      Refeição
                    </th>
                    {DAYS.map((d) => (
                      <th
                        key={d.key}
                        className="min-w-[150px] whitespace-nowrap bg-[var(--surface-2)] px-2 py-2 text-left font-bold uppercase tracking-wide text-[var(--ink-soft)]"
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {MEALS.map((meal) => (
                    <tr key={meal.key}>
                      <td className="sticky left-0 whitespace-nowrap border-t border-[var(--border-soft)] bg-[var(--surface-2)] px-2 py-2 font-bold">
                        {meal.label}
                      </td>
                      {DAYS.map((d) => {
                        const slot = weeklyMenu[d.key]?.[meal.key];
                        return (
                          <td key={d.key} className="border-t border-[var(--border-soft)] bg-[var(--surface)] px-2 py-2">
                            <textarea
                              value={slot?.descricao ?? ""}
                              onChange={(e) => updateSlot(d.key, meal.key, "descricao", e.target.value)}
                              rows={2}
                              className="mb-1 w-full resize-none rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1 text-[11px] outline-none focus:border-brand"
                              placeholder="Descrição"
                            />
                            <input
                              type="number"
                              value={slot?.kcal ?? ""}
                              onChange={(e) => updateSlot(d.key, meal.key, "kcal", e.target.value)}
                              className="mb-1 w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-1.5 py-1 text-[11px] outline-none focus:border-brand"
                              placeholder="kcal"
                            />
                            {foods.length > 0 && (
                              <select
                                value=""
                                onChange={(e) => e.target.value && substituteFood(d.key, meal.key, e.target.value)}
                                className="w-full rounded border border-[var(--border)] bg-[var(--surface-2)] px-1 py-1 text-[10px] text-[var(--ink-soft)] outline-none focus:border-brand"
                              >
                                <option value="">🔄 substituir…</option>
                                {foods.map((f) => (
                                  <option key={f.id} value={f.id}>
                                    {f.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <div className="mb-1.5 flex items-center justify-between">
                  <FieldLabel>Lista de compras (um item por linha)</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setShoppingList(buildShoppingListFromMenu(weeklyMenu).join("\n"))}
                    className="text-[11px] font-semibold text-accent-strong hover:underline"
                  >
                    gerar do cardápio
                  </button>
                </div>
                <textarea
                  value={shoppingList}
                  onChange={(e) => setShoppingList(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
              <label className="block">
                <FieldLabel>Orientações (uma por linha)</FieldLabel>
                <textarea
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  rows={6}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
            </div>

            <div className="mb-4 flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-[var(--ink-soft)]">
                <input
                  type="checkbox"
                  name="is_draft"
                  checked={isDraft}
                  onChange={(e) => setIsDraft(e.target.checked)}
                />
                Salvar como rascunho (mostra marca d&apos;água no PDF)
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Salvar protocolo</Button>
            </div>
          </form>
        </div>
      )}
    </>
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
      {children}
    </span>
  );
}

function NumField({
  label,
  name,
  step,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  step?: string;
  placeholder?: string;
  defaultValue?: number;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        name={name}
        type="number"
        step={step ?? "0.1"}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
