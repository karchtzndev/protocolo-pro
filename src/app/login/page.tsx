"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError("E-mail ou senha incorretos.");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-8 shadow-[0_8px_30px_rgba(27,33,29,.14)]"
      >
        <div className="mb-6 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-sm font-bold text-brand-on font-display">
            P
          </span>
          <span className="font-display text-base font-bold">Protocolo.Pro</span>
        </div>

        <h1 className="mb-1 text-xl font-bold">Entrar como nutricionista</h1>
        <p className="mb-6 text-sm text-[var(--ink-soft)]">
          Acesse o painel para gerenciar seus pacientes e protocolos.
        </p>

        <label className="mb-3 block">
          <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            E-mail
          </span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand"
            placeholder="voce@clinica.com"
          />
        </label>

        <label className="mb-5 block">
          <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
            Senha
          </span>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5 text-sm outline-none focus:border-brand"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>
        )}

        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Entrando..." : "Entrar"}
        </Button>

        <p className="mt-4 text-center text-xs text-[var(--ink-soft)]">
          Ainda não tem conta?{" "}
          <a href="/signup" className="font-semibold text-brand">
            Criar conta
          </a>
        </p>
      </form>
    </div>
  );
}
