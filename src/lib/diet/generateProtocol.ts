import type { DayMenu, FoodCatalogItem, FoodCategory, MealSlot, WeeklyMenu } from "@/lib/types";
import { MEAL_SCHEDULE } from "@/lib/types";
import type { Sex } from "@/lib/health/energyEquations";

export type DietObjective = "emagrecimento" | "hipertrofia" | "manutencao";

const DAY_ORDER: (keyof WeeklyMenu)[] = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];

/** Piso calórico de segurança — o motor se recusa a gerar planos abaixo disso. */
const SAFE_CALORIE_FLOOR: Record<Sex, number> = {
  masculino: 1500,
  feminino: 1200,
};

const OBJECTIVE_KCAL_ADJUSTMENT: Record<DietObjective, number> = {
  emagrecimento: -500,
  hipertrofia: 400,
  manutencao: 0,
};

const OBJECTIVE_MACROS: Record<DietObjective, { proteinGPerKg: number; fatPctKcal: number }> = {
  emagrecimento: { proteinGPerKg: 2.0, fatPctKcal: 0.25 },
  hipertrofia: { proteinGPerKg: 2.0, fatPctKcal: 0.25 },
  manutencao: { proteinGPerKg: 1.6, fatPctKcal: 0.27 },
};

const MEAL_TEMPLATE: Record<keyof DayMenu, { category: FoodCategory; share: number }[]> = {
  cafe_da_manha: [
    { category: "cereais_e_paes", share: 0.4 },
    { category: "laticinios", share: 0.3 },
    { category: "frutas", share: 0.3 },
  ],
  lanche_manha: [
    { category: "frutas", share: 0.55 },
    { category: "gorduras_e_oleaginosas", share: 0.45 },
  ],
  almoco: [
    { category: "cereais_e_paes", share: 0.25 },
    { category: "leguminosas", share: 0.15 },
    { category: "carnes_e_ovos", share: 0.35 },
    { category: "vegetais", share: 0.25 },
  ],
  lanche_tarde: [
    { category: "laticinios", share: 0.55 },
    { category: "cereais_e_paes", share: 0.45 },
  ],
  jantar: [
    { category: "carnes_e_ovos", share: 0.4 },
    { category: "tuberculos", share: 0.3 },
    { category: "vegetais", share: 0.3 },
  ],
};

export interface GenerateProtocolInput {
  sex: Sex;
  tdeeKcal: number;
  weightKg: number;
  objective: DietObjective;
  foods: FoodCatalogItem[];
  /** IDs de alimentos que o paciente já consome (da anamnese) — priorizados na montagem do cardápio. */
  preferredFoodIds?: Set<string>;
}

export interface GenerateProtocolResult {
  weekly_menu: WeeklyMenu;
  target_kcal_per_day: number;
  macro_targets: { protein_g: number; carb_g: number; fat_g: number };
}

export class SafeCalorieFloorError extends Error {}

/**
 * Teto de porção por categoria — sem isso, alimentos de baixa densidade
 * calórica (ex: vegetais a 25 kcal/100g) explodem em gramas absurdas ao
 * tentar bater a cota de calorias da refeição só por escala.
 */
const MAX_PORTION_G: Record<FoodCategory, number> = {
  cereais_e_paes: 150,
  leguminosas: 150,
  carnes_e_ovos: 200,
  laticinios: 250,
  frutas: 200,
  vegetais: 200,
  tuberculos: 200,
  gorduras_e_oleaginosas: 30,
  bebidas_e_outros: 250,
};

export function generateWeeklyMenu({
  sex,
  tdeeKcal,
  weightKg,
  objective,
  foods,
  preferredFoodIds,
}: GenerateProtocolInput): GenerateProtocolResult {
  const targetKcal = tdeeKcal + OBJECTIVE_KCAL_ADJUSTMENT[objective];
  const floor = SAFE_CALORIE_FLOOR[sex];

  if (targetKcal < floor) {
    throw new SafeCalorieFloorError(
      `O plano ficaria em ${Math.round(targetKcal)} kcal/dia, abaixo do piso de segurança de ${floor} kcal/dia. Ajuste o objetivo ou revise o gasto energético antes de gerar.`
    );
  }

  const { proteinGPerKg, fatPctKcal } = OBJECTIVE_MACROS[objective];
  const proteinG = Math.round(proteinGPerKg * weightKg);
  const fatG = Math.round((targetKcal * fatPctKcal) / 9);
  const carbG = Math.round((targetKcal - proteinG * 4 - fatG * 9) / 4);

  const menu: WeeklyMenu = {};

  DAY_ORDER.forEach((day, dayIndex) => {
    const dayMenu: DayMenu = {};
    MEAL_SCHEDULE.forEach((meal, mealIndex) => {
      const mealTargetKcal = targetKcal * meal.pctOfDay;
      dayMenu[meal.key] = buildMealSlot(MEAL_TEMPLATE[meal.key], mealTargetKcal, foods, dayIndex + mealIndex, preferredFoodIds);
    });
    menu[day] = dayMenu;
  });

  return {
    weekly_menu: menu,
    target_kcal_per_day: Math.round(targetKcal),
    macro_targets: { protein_g: proteinG, carb_g: carbG, fat_g: fatG },
  };
}

function buildMealSlot(
  template: { category: FoodCategory; share: number }[],
  mealTargetKcal: number,
  foods: FoodCatalogItem[],
  rotationSeed: number,
  preferredFoodIds?: Set<string>
): MealSlot {
  let kcal = 0;
  let proteina_g = 0;
  let carboidrato_g = 0;
  let gordura_g = 0;
  const parts: string[] = [];

  template.forEach((slot, slotIndex) => {
    const categoryPool = foods.filter((f) => f.category === slot.category);
    if (!categoryPool.length) return;

    // Prioriza alimentos que o paciente já consome (da anamnese) quando existem na categoria.
    const preferredPool = preferredFoodIds
      ? categoryPool.filter((f) => preferredFoodIds.has(f.id))
      : [];
    const pool = preferredPool.length ? preferredPool : categoryPool;
    const food = pool[(rotationSeed + slotIndex) % pool.length];

    const slotKcal = mealTargetKcal * slot.share;
    const rawGrams = Math.round((slotKcal / food.kcal_100g) * 100 / 5) * 5;
    const grams = Math.min(Math.max(5, rawGrams), MAX_PORTION_G[food.category]);

    kcal += (food.kcal_100g * grams) / 100;
    proteina_g += (food.protein_100g * grams) / 100;
    carboidrato_g += (food.carb_100g * grams) / 100;
    gordura_g += (food.fat_100g * grams) / 100;

    parts.push(`${food.name} (${grams} g)`);
  });

  return {
    descricao: parts.join(" + ") || "—",
    kcal: Math.round(kcal),
    proteina_g: Math.round(proteina_g),
    carboidrato_g: Math.round(carboidrato_g),
    gordura_g: Math.round(gordura_g),
  };
}
