import type { WeeklyMenu } from "@/lib/types";
import { parseMealItems } from "./mealItems";

/**
 * Consolida a lista de compras a partir das descrições do cardápio.
 * Só reconhece itens no formato "Nome (Xg)" (gerados pelo motor automático ou
 * pela substituição de alimento) — itens sem quantidade informada não entram
 * na soma e devem ser adicionados à mão.
 */
export function buildShoppingListFromMenu(weeklyMenu: WeeklyMenu): string[] {
  const totals = new Map<string, number>();

  for (const day of Object.values(weeklyMenu)) {
    if (!day) continue;
    for (const slot of Object.values(day)) {
      if (!slot?.descricao) continue;
      for (const item of parseMealItems(slot.descricao)) {
        if (!item.grams) continue;
        totals.set(item.name, (totals.get(item.name) ?? 0) + Number(item.grams));
      }
    }
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, grams]) => `${name} — ${Math.round(grams)} g/semana`);
}
