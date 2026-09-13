import type { FoodCatalogItem, MealSlot } from "@/lib/types";
import { parseMealItems } from "./mealItems";

export interface MealMacros {
  kcal: number;
  proteina_g: number;
  carboidrato_g: number;
  gordura_g: number;
  /** Itens que não foram encontrados no catálogo (ou sem gramas) e por isso não entraram na conta. */
  unmatched: string[];
}

/**
 * Calcula os macros de uma refeição a partir do texto "Nome (Xg) + ...",
 * casando cada item com o catálogo de alimentos. Itens digitados à mão que
 * não existem no catálogo são reportados em `unmatched` para o profissional
 * saber que aquela parte não está sendo contabilizada.
 */
export function calculateMealMacros(descricao: string, foods: FoodCatalogItem[]): MealMacros {
  const byName = new Map(foods.map((f) => [f.name.toLowerCase(), f]));
  const result: MealMacros = { kcal: 0, proteina_g: 0, carboidrato_g: 0, gordura_g: 0, unmatched: [] };

  for (const item of parseMealItems(descricao)) {
    const food = byName.get(item.name.toLowerCase());
    const grams = Number(item.grams);

    if (!food || !grams) {
      result.unmatched.push(item.name);
      continue;
    }

    result.kcal += (food.kcal_100g * grams) / 100;
    result.proteina_g += (food.protein_100g * grams) / 100;
    result.carboidrato_g += (food.carb_100g * grams) / 100;
    result.gordura_g += (food.fat_100g * grams) / 100;
  }

  return {
    kcal: Math.round(result.kcal),
    proteina_g: Math.round(result.proteina_g),
    carboidrato_g: Math.round(result.carboidrato_g),
    gordura_g: Math.round(result.gordura_g),
    unmatched: result.unmatched,
  };
}

/** Soma as calorias de um dia inteiro do cardápio. */
export function dayTotalKcal(day: Partial<Record<string, MealSlot>> | undefined): number {
  if (!day) return 0;
  return Object.values(day).reduce((total, slot) => total + (slot?.kcal ?? 0), 0);
}
