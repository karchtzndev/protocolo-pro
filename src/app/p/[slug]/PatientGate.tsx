"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { acceptConsent, verifyPin } from "./actions";

export function PatientGate({
  slug,
  patientFirstName,
  clinicName,
  alreadyConsented,
}: {
  slug: string;
  patientFirstName: string;
  clinicName: string;
  alreadyConsented: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"consent" | "pin">(alreadyConsented ? "pin" : "consent");
  const [checked, setChecked] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConsent() {
    await acceptConsent(slug);
    setStep("pin");
  }

  async function handlePin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await verifyPin(slug, pin);
    if (!result.ok) {
      setError(result.error ?? "PIN incorreto.");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-6 py-10">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto mb-4 flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-brand font-display text-xl font-bold text-brand-on">
          {clinicName[0]}
        </div>

        {step === "consent" ? (
          <>
            <h1 className="mb-2 text-lg font-bold">Antes de começar</h1>
            <p className="mb-4 text-sm text-[var(--ink-soft)]">
              {clinicName} usa seus dados de saúde apenas para elaborar e acompanhar seu protocolo alimentar.
            </p>
            <div className="mb-4 max-h-32 overflow-auto rounded-lg border border-[var(--border-soft)] bg-[var(--surface)] p-3.5 text-left text-xs text-[var(--ink-soft)] leading-relaxed">
              Ao continuar, você concorda com o tratamento dos seus dados de saúde conforme a LGPD (Lei nº
              13.709/2018), exclusivamente para fins de acompanhamento nutricional prestado por esta clínica. Seus
              dados não serão compartilhados com terceiros sem autorização.
            </div>
            <label className="mb-5 flex items-start gap-2.5 text-left text-xs text-[var(--ink-soft)]">
              <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} className="mt-0.5" />
              Li e concordo com o uso dos meus dados para acompanhamento nutricional.
            </label>
            <button
              disabled={!checked}
              onClick={handleConsent}
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-brand-on disabled:opacity-50"
            >
              Concordo e continuar
            </button>
          </>
        ) : (
          <form onSubmit={handlePin}>
            <h1 className="mb-2 text-lg font-bold">Olá, {patientFirstName}</h1>
            <p className="mb-5 text-sm text-[var(--ink-soft)]">
              Digite os 4 números da sua data de nascimento (mês e dia, ex: 1204 para 12/04).
            </p>
            <input
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              maxLength={4}
              className="mb-4 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center font-mono-data text-2xl tracking-[0.5em] outline-none focus:border-brand"
              placeholder="••••"
              autoFocus
            />
            {error && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
            <button
              type="submit"
              disabled={pin.length < 4 || loading}
              className="w-full rounded-lg bg-brand py-3 text-sm font-semibold text-brand-on disabled:opacity-50"
            >
              {loading ? "Verificando..." : "Entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
