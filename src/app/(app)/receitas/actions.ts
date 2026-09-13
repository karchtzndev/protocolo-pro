"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import type { RecipeIngredient } from "@/lib/types";

export async function createRecipe(formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const name = String(formData.get("name") || "").trim();
  const instructions = String(formData.get("instructions") || "").trim();
  if (!name || !instructions) throw new Error("Nome e modo de preparo são obrigatórios.");

  const names = formData.getAll("ingredient_name").map(String);
  const quantities = formData.getAll("ingredient_quantity").map(String);
  const ingredients: RecipeIngredient[] = names
    .map((n, i) => ({ name: n.trim(), quantity: (quantities[i] ?? "").trim() }))
    .filter((i) => i.name);

  const prepTime = Number(formData.get("prep_time_min"));

  const { error } = await supabase.from("recipes").insert({
    nutritionist_id: user.id,
    name,
    description: String(formData.get("description") || "").trim() || null,
    instructions,
    ingredients,
    prep_time_min: Number.isFinite(prepTime) && prepTime > 0 ? Math.round(prepTime) : null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/receitas");
}

export async function deleteRecipe(recipeId: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase.from("recipes").delete().eq("id", recipeId).eq("nutritionist_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/receitas");
}
