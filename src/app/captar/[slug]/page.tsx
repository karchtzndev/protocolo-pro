import { notFound } from "next/navigation";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Nutritionist } from "@/lib/types";
import { captureLead } from "./actions";

export default async function CapturePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = createServiceRoleClient();

  const { data: nutritionist } = await supabase
    .from("nutritionists")
    .select("*")
    .eq("booking_slug", slug)
    .single<Nutritionist>();

  if (!nutritionist) notFound();

  const clinicName = nutritionist.clinic_name ?? nutritionist.full_name;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        {nutritionist.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={nutritionist.logo_url} alt={clinicName} className="mx-auto mb-3 h-14 object-contain" />
        ) : null}
        <h1 className="text-xl font-bold">{clinicName}</h1>
        <p className="mt-1 text-sm text-[var(--ink-soft)]">Preencha seus dados para iniciar seu acompanhamento nutricional.</p>
      </div>

      <form action={captureLead.bind(null, slug)} className="flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-5 shadow-sm">
        <Field label="Nome completo" name="full_name" required />
        <Field label="Data de nascimento" name="birth_date" type="date" required />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Sexo</FieldLabel>
            <select name="sex" className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
              <option value="feminino">Feminino</option>
              <option value="masculino">Masculino</option>
              <option value="outro">Outro</option>
            </select>
          </div>
          <Field label="Telefone" name="phone" />
        </div>
        <Field label="E-mail" name="email" type="email" />
        <Field label="O que você busca?" name="objective" placeholder="Emagrecimento, hipertrofia..." />

        <button
          type="submit"
          className="mt-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-bold text-brand-on hover:opacity-90"
        >
          Iniciar meu acompanhamento
        </button>
        <p className="text-center text-[10.5px] text-[var(--ink-faint)]">
          Você será direcionado para preencher sua anamnese e anexar exames.
        </p>
      </form>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">{children}</span>;
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <FieldLabel>{label}</FieldLabel>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
