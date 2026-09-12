"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
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

export function AnamnesisForm({ anamnesisId, slug }: { anamnesisId: string; slug: string }) {
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
