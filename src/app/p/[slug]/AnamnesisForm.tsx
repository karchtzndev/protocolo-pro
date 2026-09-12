"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FoodCatalogItem, FoodCategory } from "@/lib/types";
import { submitAnamnesis } from "./actions";

const FIELDS: { name: string; label: string; placeholder?: string }[] = [
  { name: "habitos_alimentares", label: "Como são seus hábitos alimentares hoje?", placeholder: "quantas refeições por dia, o que costuma comer..." },
  { name: "historico_familiar", label: "Histórico familiar de saúde", placeholder: "diabetes, hipertensão, obesidade na família..." },
  { name: "atividade_fisica", label: "Atividade física", placeholder: "frequência e tipo de exercício" },
  { name: "qualidade_sono", label: "Como está seu sono?", placeholder: "horas por noite, qualidade" },
  { name: "uso_medicamentos", label: "Usa algum medicamento?", placeholder: "nome e frequência" },
  { name: "alergias_intolerancias", label: "Alergias ou intolerâncias alimentares" },
  { name: "tabagismo_alcool", label: "Tabagismo ou consumo de álcool" },
  { name: "observacoes", label: "Alguma outra observação para seu nutricionista?" },
];

const CATEGORY_LABELS: Record<FoodCategory, string> = {
  cereais_e_paes: "Cereais e pães",
  leguminosas: "Leguminosas (feijão, lentilha...)",
  carnes_e_ovos: "Carnes e ovos",
  laticinios: "Laticínios",
  frutas: "Frutas",
  vegetais: "Vegetais",
  tuberculos: "Tubérculos (batata, mandioca...)",
  gorduras_e_oleaginosas: "Gorduras e oleaginosas",
  bebidas_e_outros: "Bebidas e outros",
};

export function AnamnesisForm({ anamnesisId, slug, foods }: { anamnesisId: string; slug: string; foods: FoodCatalogItem[] }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  if (submitted) {
    return (
      <div className="mb-4 rounded-2xl border border-success bg-success-soft p-4 text-sm text-success">
        ✓ Anamnese enviada! Obrigado — seu nutricionista já pode ver suas respostas antes da consulta.
      </div>
    );
  }

  const byCategory = new Map<FoodCategory, FoodCatalogItem[]>();
  for (const food of foods) {
    if (!byCategory.has(food.category)) byCategory.set(food.category, []);
    byCategory.get(food.category)!.push(food);
  }

  return (
    <form
      ref={formRef}
      action={async (formData) => {
        setSaving(true);
        try {
          await submitAnamnesis(slug, anamnesisId, formData);
          setSubmitted(true);
          router.refresh();
        } finally {
          setSaving(false);
        }
      }}
      className="mb-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-[0_8px_30px_rgba(27,33,29,.1)]"
    >
      <h4 className="mb-1 text-[13.5px] font-semibold">📋 Antes da sua consulta</h4>
      <p className="mb-3 text-xs text-[var(--ink-soft)]">
        Seu nutricionista pediu para você preencher esta ficha antes do atendimento.
      </p>

      <div className="space-y-3">
        {FIELDS.map((f) => (
          <label key={f.name} className="block">
            <span className="mb-1 block text-xs font-semibold">{f.label}</span>
            <textarea
              name={f.name}
              placeholder={f.placeholder}
              rows={2}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </label>
        ))}
      </div>

      {byCategory.size > 0 && (
        <>
          <FoodChecklist
            byCategory={byCategory}
            fieldName="alimentos_habituais"
            title="Marque os alimentos que você já costuma comer"
            description="Isso ajuda seu nutricionista a montar um plano com coisas que você já gosta e tem em casa."
          />
          <FoodChecklist
            byCategory={byCategory}
            fieldName="alimentos_intolerancia"
            title="Marque alimentos que você NÃO pode comer (alergia ou intolerância)"
            description="Esses alimentos ficam automaticamente de fora do seu protocolo."
            highlight="danger"
          />
        </>
      )}

      <button
        type="submit"
        disabled={saving}
        className="mt-4 w-full rounded-lg bg-brand py-2.5 text-sm font-semibold text-brand-on disabled:opacity-50"
      >
        {saving ? "Enviando…" : "Enviar respostas"}
      </button>
    </form>
  );
}

function FoodChecklist({
  byCategory,
  fieldName,
  title,
  description,
  highlight,
}: {
  byCategory: Map<FoodCategory, FoodCatalogItem[]>;
  fieldName: string;
  title: string;
  description: string;
  highlight?: "danger";
}) {
  return (
    <div className="mt-4">
      <span className={`mb-1 block text-xs font-semibold ${highlight === "danger" ? "text-danger" : ""}`}>{title}</span>
      <p className="mb-2 text-[11px] text-[var(--ink-soft)]">{description}</p>
      <div
        className={`max-h-64 space-y-3 overflow-y-auto rounded-lg border p-3 ${
          highlight === "danger" ? "border-danger" : "border-[var(--border-soft)]"
        }`}
      >
        {Array.from(byCategory.entries()).map(([category, items]) => (
          <div key={category}>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
              {CATEGORY_LABELS[category]}
            </p>
            <div className="grid grid-cols-2 gap-1 sm:grid-cols-3">
              {items.map((food) => (
                <label key={food.id} className="flex items-center gap-1.5 text-xs">
                  <input type="checkbox" name={fieldName} value={food.id} />
                  {food.name}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
