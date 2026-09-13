"use client";

import { useTransition } from "react";
import { deleteRecipe } from "./actions";

export function DeleteRecipeButton({ recipeId }: { recipeId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("Excluir esta receita? Ela será removida das refeições que a usam.")) return;
        startTransition(() => deleteRecipe(recipeId));
      }}
      className="rounded-md px-1.5 py-0.5 text-xs text-[var(--ink-faint)] hover:bg-danger-soft hover:text-danger"
    >
      ✕
    </button>
  );
}
