"use client";

import { useState, useTransition } from "react";
import { sendReminderPush } from "./push-actions";

export function SendReminderButton({ patientId }: { patientId: string }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          setResult(null);
          startTransition(async () => {
            const res = await sendReminderPush(patientId);
            if (res.reason === "not_configured") setResult("Push não configurado ainda.");
            else if (res.sent === 0) setResult("Paciente não ativou lembretes no app.");
            else setResult(`Enviado para ${res.sent} dispositivo(s).`);
          });
        }}
        className="rounded-full border border-[var(--border)] px-3 py-1 text-[11px] font-semibold text-[var(--ink-soft)] hover:border-brand hover:text-brand disabled:opacity-60"
      >
        {isPending ? "Enviando..." : "🔔 Enviar lembrete"}
      </button>
      {result && <span className="text-[10.5px] text-[var(--ink-faint)]">{result}</span>}
    </div>
  );
}
