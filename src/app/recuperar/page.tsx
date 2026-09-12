"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";

export default function RecuperarPage() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/redefinir-senha`,
    });

    setLoading(false);
    if (error) {
      setError("Não foi possível enviar o e-mail. Tente novamente.");
      return;
    }
    setSent(true);
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

        <h1 className="mb-1 text-xl font-bold">Recuperar senha</h1>
        <p className="mb-6 text-sm text-[var(--ink-soft)]">
          Informe seu e-mail e enviaremos um link para redefinir sua senha.
        </p>

        {sent ? (
          <p className="rounded-lg bg-success-soft px-3 py-2 text-sm text-success">
            Se o e-mail existir na nossa base, um link de redefinição foi enviado. Confira sua caixa de entrada.
          </p>
        ) : (
          <>
            <label className="mb-5 block">
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

            {error && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Enviando..." : "Enviar link de recuperação"}
            </Button>
          </>
        )}

        <p className="mt-4 text-center text-xs text-[var(--ink-soft)]">
          <a href="/login" className="font-semibold text-brand">
            Voltar para o login
          </a>
        </p>
      </form>
    </div>
  );
}
