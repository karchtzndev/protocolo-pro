import { createClient } from "@/lib/supabase/server";
import { Badge } from "@/components/ui/Badge";
import type { Recipe } from "@/lib/types";
import { RecipeDialog } from "./RecipeDialog";
import { DeleteRecipeButton } from "./DeleteRecipeButton";

export default async function ReceitasPage() {
  const supabase = await createClient();
  const { data: recipes } = await supabase.from("recipes").select("*").order("name").returns<Recipe[]>();

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Receitas</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Vincule uma receita a qualquer refeição do cardápio — o paciente vê o modo de preparo no app.
          </p>
        </div>
        <RecipeDialog />
      </div>

      {recipes?.length ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {recipes.map((recipe) => (
            <div key={recipe.id} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <div>
                  <b className="text-sm">{recipe.name}</b>
                  {recipe.description && (
                    <p className="mt-0.5 text-xs text-[var(--ink-soft)]">{recipe.description}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {recipe.prep_time_min && <Badge tone="neutral">{recipe.prep_time_min} min</Badge>}
                  <DeleteRecipeButton recipeId={recipe.id} />
                </div>
              </div>

              {recipe.ingredients.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {recipe.ingredients.map((ing, i) => (
                    <span key={i} className="rounded-full bg-[var(--surface-2)] px-2 py-0.5 text-[11px] text-[var(--ink-soft)]">
                      {ing.name}
                      {ing.quantity ? ` — ${ing.quantity}` : ""}
                    </span>
                  ))}
                </div>
              )}

              <details className="mt-2.5">
                <summary className="cursor-pointer text-xs font-semibold text-accent-strong">Modo de preparo</summary>
                <p className="mt-1.5 whitespace-pre-line text-xs leading-relaxed text-[var(--ink-soft)]">
                  {recipe.instructions}
                </p>
              </details>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--ink-soft)]">
          Nenhuma receita cadastrada. Crie a primeira para anexar o modo de preparo às refeições.
        </p>
      )}
    </div>
  );
}
