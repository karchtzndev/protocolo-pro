export interface MealItem {
  name: string;
  grams: string;
}

const ITEM_PATTERN = /^(.+?)\s*\((\d+(?:\.\d+)?)\s*g\)$/i;

/** Quebra "Arroz (100g) + Frango (150g)" nos itens e isola a quantidade de cada um. */
export function parseMealItems(descricao: string | undefined): MealItem[] {
  if (!descricao?.trim()) return [];
  return descricao
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const match = ITEM_PATTERN.exec(part);
      return match ? { name: match[1], grams: match[2] } : { name: part, grams: "" };
    });
}

/** Reconstrói a string "Nome (Xg) + Nome2 (Yg)" — mesmo formato que o resto do app já espera. */
export function serializeMealItems(items: MealItem[]): string {
  return items
    .map((i) => ({ name: i.name.trim(), grams: i.grams.trim() }))
    .filter((i) => i.name)
    .map((i) => (i.grams ? `${i.name} (${i.grams}g)` : i.name))
    .join(" + ");
}
