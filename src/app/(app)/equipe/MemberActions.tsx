"use client";

import { useState, useTransition } from "react";
import { removeMember, revokeInvite } from "./actions";

export function MemberActions({ memberId, kind }: { memberId: string; kind: "member" | "invite" }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label = kind === "member" ? "Remover" : "Cancelar";
  const confirmText =
    kind === "member"
      ? "Remover este profissional da clínica? Ele perde o acesso aos pacientes compartilhados."
      : "Cancelar este convite?";

  return (
    <div className="flex flex-col items-end">
      <button
        type="button"
        disabled={isPending}
        onClick={() => {
          if (!confirm(confirmText)) return;
          setError(null);
          startTransition(async () => {
            try {
              if (kind === "member") await removeMember(memberId);
              else await revokeInvite(memberId);
            } catch (err) {
              setError(err instanceof Error ? err.message : "Erro.");
            }
          });
        }}
        className="rounded-md px-2 py-1 text-xs font-semibold text-[var(--ink-faint)] hover:bg-danger-soft hover:text-danger"
      >
        {label}
      </button>
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}
