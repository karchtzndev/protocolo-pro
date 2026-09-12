"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { logAudit } from "@/lib/audit";
import { checkFormulaInteractions } from "@/lib/interactionCheck";
import type { FormulaIngredient, SubstanceInteraction } from "@/lib/types";

export async function createCompoundedFormula(patientId: string, formData: FormData) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const name = String(formData.get("name") || "").trim();
  if (!name) throw new Error("Nome da fórmula é obrigatório.");

  const ingredientNames = formData.getAll("ingredient_name").map(String);
  const ingredientDoses = formData.getAll("ingredient_dose").map(String);
  const ingredientUnits = formData.getAll("ingredient_unit").map(String);

  const ingredients: FormulaIngredient[] = ingredientNames
    .map((rawName, i) => ({ name: rawName.trim(), dose: Number(ingredientDoses[i]), unit: ingredientUnits[i] || "mg" }))
    .filter((ing) => ing.name && ing.dose > 0);

  if (!ingredients.length) throw new Error("Adicione ao menos um ingrediente com dose válida.");

  const { data: catalog } = await supabase.from("substance_interactions").select("*").returns<SubstanceInteraction[]>();
  const warnings = checkFormulaInteractions(ingredients, catalog ?? []);

  const { error } = await supabase.from("compounded_formulas").insert({
    nutritionist_id: user.id,
    patient_id: patientId,
    name,
    ingredients,
    interaction_warnings: warnings.map((w) => `[${w.severity}] ${w.message}`),
  });
  if (error) throw new Error(error.message);

  await logAudit(user.id, "suplementacao.salvar", {
    targetType: "compounded_formula",
    targetId: patientId,
    metadata: { name, warning_count: warnings.length },
  });

  revalidatePath(`/pacientes/${patientId}`);
}

export async function removeCompoundedFormula(patientId: string, formulaId: string) {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const { error } = await supabase
    .from("compounded_formulas")
    .delete()
    .eq("id", formulaId)
    .eq("nutritionist_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/pacientes/${patientId}`);
}
