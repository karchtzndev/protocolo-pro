import type { WeeklyMenu } from "@/lib/types";

const ITEM_PATTERN = /^(.+?)\s*\((\d+(?:\.\d+)?)\s*g\)$/;

/**
 * Consolida a lista de compras a partir das descrições do cardápio.
 * Só reconhece itens no formato "Nome (Xg)" (gerados pelo motor automático ou
 * pela substituição de alimento) — descrições livres digitadas manualmente
 * não entram na soma e devem ser adicionadas à mão.
 */
export function buildShoppingListFromMenu(weeklyMenu: WeeklyMenu): string[] {
  const totals = new Map<string, number>();

  for (const day of Object.values(weeklyMenu)) {
    if (!day) continue;
    for (const slot of Object.values(day)) {
      if (!slot?.descricao) continue;
      for (const part of slot.descricao.split("+")) {
        const match = ITEM_PATTERN.exec(part.trim());
        if (!match) continue;
        const [, name, grams] = match;
        totals.set(name, (totals.get(name) ?? 0) + Number(grams));
      }
    }
  }

  return Array.from(totals.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, grams]) => `${name} — ${Math.round(grams)} g/semana`);
}
