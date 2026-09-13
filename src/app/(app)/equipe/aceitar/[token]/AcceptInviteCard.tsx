"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { acceptInvite } from "../../actions";

export function AcceptInviteCard({ token }: { token: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);

  if (joined) {
    return (
      <div className="rounded-2xl border border-success bg-success-soft p-6 text-center">
        <h1 className="mb-1 text-lg font-bold text-success">Você entrou em {joined} 🎉</h1>
        <p className="mb-4 text-sm text-success">Agora você compartilha a carteira de pacientes da clínica.</p>
        <Link href="/pacientes">
          <Button>Ver pacientes</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6 text-center shadow-sm">
      <h1 className="mb-1 text-lg font-bold">Convite para uma clínica</h1>
      <p className="mb-5 text-sm text-[var(--ink-soft)]">
        Ao aceitar, você passa a atender junto com a equipe e a enxergar os mesmos pacientes. Seus pacientes atuais
        também passam a ser visíveis para a equipe.
      </p>

      {error && <p className="mb-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}

      <Button
        disabled={isPending}
        onClick={() => {
          setError(null);
          startTransition(async () => {
            try {
              const { clinicName } = await acceptInvite(token);
              setJoined(clinicName);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Não foi possível aceitar o convite.");
            }
          });
        }}
      >
        {isPending ? "Entrando..." : "Aceitar convite"}
      </Button>
    </div>
  );
}
