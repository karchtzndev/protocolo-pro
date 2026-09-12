import type { FormulaIngredient, SubstanceInteraction } from "./types";

/**
 * Compara os ingredientes de uma fórmula manipulada contra a tabela de
 * interações conhecidas. Casamento por substring (case-insensitive) em
 * ambos os sentidos do par — "ferro" na fórmula bate com "ferro" cadastrado
 * mesmo que o nome completo seja "sulfato ferroso".
 */
export function checkFormulaInteractions(
  ingredients: FormulaIngredient[],
  catalog: SubstanceInteraction[]
): { severity: SubstanceInteraction["severity"]; message: string }[] {
  const names = ingredients.map((i) => i.name.toLowerCase().trim()).filter(Boolean);
  const warnings: { severity: SubstanceInteraction["severity"]; message: string }[] = [];

  for (const rule of catalog) {
    const a = rule.substance_a.toLowerCase();
    const b = rule.substance_b.toLowerCase();

    const matchesA = names.some((n) => n.includes(a) || a.includes(n));
    const matchesB = names.some((n) => n.includes(b) || b.includes(n));

    if (matchesA && matchesB) {
      warnings.push({
        severity: rule.severity,
        message: `${rule.substance_a} + ${rule.substance_b}: ${rule.description}`,
      });
    }
  }

  return warnings;
}
