import type { FoodCatalogItem } from "@/lib/types";

export interface EquivalenceRow {
  food: FoodCatalogItem;
  gramsForSameKcal: number;
}

/**
 * Para um alimento de referência, retorna alternativas da mesma categoria
 * com a quantidade (g) que entrega aproximadamente as mesmas calorias —
 * a "tabela de equivalências rápidas" para trocas do dia a dia.
 */
export function findEquivalents(reference: FoodCatalogItem, catalog: FoodCatalogItem[], referenceGrams: number, limit = 4): EquivalenceRow[] {
  const targetKcal = (reference.kcal_100g * referenceGrams) / 100;

  return catalog
    .filter((f) => f.category === reference.category && f.id !== reference.id)
    .map((food) => ({
      food,
      gramsForSameKcal: Math.round((targetKcal / food.kcal_100g) * 100),
    }))
    .sort((a, b) => a.food.name.localeCompare(b.food.name))
    .slice(0, limit);
}
