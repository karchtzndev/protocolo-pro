"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { updateLogoUrl } from "./actions";

export function LogoUpload({ nutritionistId, currentLogoUrl }: { nutritionistId: string; currentLogoUrl: string | null }) {
  const router = useRouter();
  const supabase = createClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Envie uma imagem (PNG, JPG ou SVG).");
      return;
    }

    setUploading(true);
    setError(null);

    const path = `${nutritionistId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage.from("logos").upload(path, file, { upsert: true });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("logos").getPublicUrl(path);

    await updateLogoUrl(publicUrl);
    setUploading(false);
    router.refresh();
  }

  return (
    <div className="flex items-center gap-3">
      {currentLogoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentLogoUrl} alt="Logo da clínica" className="h-12 w-12 rounded-lg border border-[var(--border)] object-cover" />
      ) : (
        <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-[10px] text-[var(--ink-faint)]">
          sem logo
        </div>
      )}
      <div>
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold hover:border-brand disabled:opacity-50"
        >
          {uploading ? "Enviando…" : currentLogoUrl ? "Trocar logo" : "Enviar logo"}
        </button>
        {error && <p className="mt-1 text-[11px] text-danger">{error}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}
