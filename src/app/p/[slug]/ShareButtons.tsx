"use client";

export function ShareButtons({
  patientName,
  patientId,
  clinicName,
}: {
  patientName: string;
  patientId: string;
  clinicName: string;
}) {
  const pdfUrl = `/api/pdf/protocolo/${patientId}`;
  const shareText = encodeURIComponent(
    `Olá! Aqui está o meu protocolo alimentar de ${clinicName}: ${typeof window !== "undefined" ? window.location.href : ""}`
  );

  return (
    <div className="fixed inset-x-0 bottom-0 mx-auto flex w-full max-w-md flex-col gap-2 bg-gradient-to-t from-[var(--bg)] via-[var(--bg)] to-transparent px-4 pb-5 pt-6">
      <a
        href={pdfUrl}
        target="_blank"
        rel="noreferrer"
        className="w-full rounded-xl bg-accent py-3.5 text-center text-sm font-bold text-white shadow-lg"
      >
        ⭳ Baixar protocolo em PDF
      </a>
      <div className="flex gap-2">
        <a
          href={`https://wa.me/?text=${shareText}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 text-center text-xs font-semibold text-[var(--ink-soft)]"
        >
          ↗ WhatsApp
        </a>
        <a
          href={`mailto:?subject=${encodeURIComponent(`Protocolo de ${patientName}`)}&body=${shareText}`}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2.5 text-center text-xs font-semibold text-[var(--ink-soft)]"
        >
          ✉ E-mail
        </a>
      </div>
    </div>
  );
}
