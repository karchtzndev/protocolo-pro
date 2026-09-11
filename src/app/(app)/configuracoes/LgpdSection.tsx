"use client";

import { useRouter } from "next/navigation";
import type { AccountDeletionRequest } from "@/lib/types";
import { requestAccountDeletion, cancelAccountDeletion } from "./lgpd-actions";

export function LgpdSection({ pendingRequest }: { pendingRequest: AccountDeletionRequest | null }) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-sm">
        <span>Exportar todos os meus dados (JSON)</span>
        <a
          href="/api/lgpd/export"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:border-brand"
        >
          ⭳ Exportar
        </a>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-[var(--border-soft)] bg-[var(--surface-2)] px-4 py-3 text-sm">
        {pendingRequest ? (
          <>
            <span className="text-warning">
              Exclusão de conta solicitada em {new Date(pendingRequest.requested_at).toLocaleDateString("pt-BR")}.
            </span>
            <button
              type="button"
              onClick={async () => {
                await cancelAccountDeletion(pendingRequest.id);
                router.refresh();
              }}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:border-brand"
            >
              Cancelar solicitação
            </button>
          </>
        ) : (
          <>
            <span>Solicitar exclusão da minha conta e dados</span>
            <button
              type="button"
              onClick={async () => {
                if (!confirm("Confirmar solicitação de exclusão de conta? Você pode cancelar depois, enquanto não for concluída.")) return;
                await requestAccountDeletion();
                router.refresh();
              }}
              className="rounded-lg border border-danger bg-danger-soft px-3 py-1.5 text-xs font-semibold text-danger hover:brightness-95"
            >
              Solicitar exclusão
            </button>
          </>
        )}
      </div>
    </div>
  );
}
