import type { Recipe } from "@/lib/types";

/** Modo de preparo da refeição, recolhido por padrão pra não poluir a lista do dia. */
export function RecipeDisclosure({ recipe }: { recipe: Recipe | undefined }) {
  if (!recipe) return null;

  return (
    <details className="mt-1.5 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] px-2.5 py-1.5">
      <summary className="cursor-pointer text-[11px] font-semibold text-accent-strong">
        👩‍🍳 Como preparar — {recipe.name}
        {recipe.prep_time_min ? ` (${recipe.prep_time_min} min)` : ""}
      </summary>
      {recipe.ingredients.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {recipe.ingredients.map((ing, i) => (
            <li key={i} className="text-[11px] text-[var(--ink-soft)]">
              • {ing.name}
              {ing.quantity ? ` — ${ing.quantity}` : ""}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 whitespace-pre-line text-[11px] leading-relaxed text-[var(--ink-soft)]">{recipe.instructions}</p>
    </details>
  );
}
