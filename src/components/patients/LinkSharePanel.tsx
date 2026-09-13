"use client";

import { useState } from "react";

export function LinkSharePanel({ slug, phone, email }: { slug: string; phone?: string; email?: string }) {
  const url = typeof window !== "undefined" ? `${window.location.origin}/p/${slug}` : "";
  const message = `Olá! Para começar seu acompanhamento, preencha sua anamnese pelo link: ${url}`;
  const whatsappHref = phone
    ? `https://wa.me/55${phone.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;

  return (
    <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-2)] p-3.5">
      <div className="mb-3 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono-data text-xs text-[var(--ink-soft)]">/p/{slug}</code>
        <CopyButton url={url} />
      </div>
      <div className="flex gap-2">
        <a
          href={whatsappHref}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-center text-xs font-semibold text-[var(--ink-soft)]"
        >
          ↗ WhatsApp
        </a>
        <a
          href={`mailto:${email ?? ""}?subject=${encodeURIComponent("Anamnese — antes da sua consulta")}&body=${encodeURIComponent(message)}`}
          className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 text-center text-xs font-semibold text-[var(--ink-soft)]"
        >
          ✉ E-mail
        </a>
      </div>
    </div>
  );
}

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs font-semibold text-[var(--ink-soft)]"
    >
      {copied ? "Copiado!" : "Copiar"}
    </button>
  );
}
