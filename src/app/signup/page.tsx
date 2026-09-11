"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ full_name: "", crn: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.full_name, crn: form.crn },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (!data.session) {
      // Confirmação de e-mail está ativada no projeto Supabase — a sessão só
      // é criada depois que o link enviado por e-mail é confirmado.
      setAwaitingConfirmation(true);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (awaitingConfirmation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-8 text-center shadow-[0_8px_30px_rgba(27,33,29,.14)]">
          <h1 className="mb-2 text-xl font-bold">Confirme seu e-mail</h1>
          <p className="text-sm text-[var(--ink-soft)]">
            Enviamos um link de confirmação para <b>{form.email}</b>. Clique nele para ativar sua conta e entrar no
            painel.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-8 shadow-[0_8px_30px_rgba(27,33,29,.14)]"
      >
        <h1 className="mb-1 text-xl font-bold">Criar conta de nutricionista</h1>
        <p className="mb-6 text-sm text-[var(--ink-soft)]">Comece seu período de teste do Protocolo.Pro.</p>

        <Input label="Nome completo" value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} />
        <Input label="Registro (CRN)" value={form.crn} onChange={(v) => setForm({ ...form, crn: v })} />
        <Input label="E-mail" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        <Input label="Senha" type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />

        {error && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Criando conta..." : "Criar conta"}
        </Button>

        <p className="mt-4 text-center text-xs text-[var(--ink-soft)]">
          Já tem conta?{" "}
          <Link href="/login" className="font-semibold text-brand">
            Entrar
          </Link>
        </p>
      </form>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
        {label}
      </span>
      <input
        type={type}
        required
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand"
      />
    </label>
  );
}
