"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import type { Exam, ExamResult } from "@/lib/types";
import { confirmExamResult, addManualExamResult } from "./exam-actions";

const EXTRACTION_LABEL: Record<string, string> = {
  texto_pdf: "texto do PDF",
  ia_visao: "IA (visão)",
};

export function ExamesTab({ patientId, exams }: { patientId: string; exams: (Exam & { results: ExamResult[] })[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setUploading(true);
    const body = new FormData();
    body.append("file", file);
    body.append("patient_id", patientId);

    try {
      const res = await fetch("/api/exams/extract", { method: "POST", body });
      if (!res.ok) throw new Error(await res.text());
      router.refresh();
    } catch (err) {
      alert("Falha ao processar o exame: " + (err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`mb-6 cursor-pointer rounded-xl border-2 border-dashed p-7 text-center text-sm text-[var(--ink-soft)] ${
          dragOver ? "border-brand bg-[var(--surface)]" : "border-[var(--border)] bg-[var(--surface-2)]"
        }`}
      >
        <div className="mb-2 text-xl">⇪</div>
        {uploading ? (
          "Processando exame (extração de texto)..."
        ) : (
          <>
            Arraste um PDF ou imagem do exame aqui, ou <b className="text-brand">selecione um arquivo</b>
            <br />
            <span className="text-[11px]">Extração automática de texto via OCR</span>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {exams.length === 0 && (
        <p className="text-center text-sm text-[var(--ink-soft)]">Nenhum exame enviado ainda.</p>
      )}

      {exams.map((exam) => {
        const outCount = exam.results.filter((r) => r.out_of_range).length;
        return (
          <div key={exam.id} className="mb-4 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
            <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
              <h3 className="text-sm font-semibold">
                Exame — {exam.exam_date ? new Date(exam.exam_date).toLocaleDateString("pt-BR") : "data não identificada"}
              </h3>
              {exam.status === "processando" ? (
                <Badge tone="neutral">processando</Badge>
              ) : exam.status === "erro" ? (
                <Badge tone="warning">extração automática falhou</Badge>
              ) : outCount > 0 ? (
                <Badge tone="danger">{outCount} fora da faixa</Badge>
              ) : (
                <Badge tone="success">tudo normal</Badge>
              )}
            </div>
            {exam.results.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <Th>Exame</Th>
                      <Th>Resultado</Th>
                      <Th>Referência</Th>
                      <Th>Extração</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {exam.results.map((r) => (
                      <ExamResultRow key={r.id} patientId={patientId} result={r} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {exam.status === "erro" && <ManualExamResultForm patientId={patientId} examId={exam.id} />}
          </div>
        );
      })}
    </div>
  );
}

function ExamResultRow({ patientId, result }: { patientId: string; result: ExamResult }) {
  const [value, setValue] = useState(result.result_value);
  const [saving, setSaving] = useState(false);

  return (
    <tr className={result.out_of_range ? "shadow-[inset_3px_0_0_var(--color-danger)]" : ""}>
      <Td>{result.test_name}</Td>
      <Td>
        {result.confirmed ? (
          <span className={`font-mono-data font-semibold ${result.out_of_range ? "text-danger" : ""}`}>{result.result_value}</span>
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-28 rounded border border-warning bg-[var(--surface-2)] px-1.5 py-1 font-mono-data text-xs"
          />
        )}
      </Td>
      <Td>{result.reference_range ?? "—"}</Td>
      <Td>
        <span className="text-[11px] text-[var(--ink-faint)]">
          {result.metodo_extracao ? EXTRACTION_LABEL[result.metodo_extracao] : "manual"}
        </span>
      </Td>
      <Td>
        {result.confirmed ? (
          <Badge tone={result.out_of_range ? "danger" : "success"}>{result.out_of_range ? "fora da faixa" : "normal"}</Badge>
        ) : (
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await confirmExamResult(patientId, result.id, value);
              } finally {
                setSaving(false);
              }
            }}
            className="rounded-md bg-warning-soft px-2 py-1 text-xs font-bold text-warning hover:brightness-95"
          >
            {saving ? "salvando…" : "confirmar"}
          </button>
        )}
      </Td>
    </tr>
  );
}

function ManualExamResultForm({ patientId, examId }: { patientId: string; examId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      action={async (formData) => {
        await addManualExamResult(patientId, examId, formData);
        formRef.current?.reset();
      }}
      className="flex flex-wrap items-end gap-2 border-t border-[var(--border-soft)] p-3"
    >
      <p className="w-full text-xs text-[var(--ink-soft)]">
        Não foi possível ler este PDF automaticamente — digite os marcadores manualmente:
      </p>
      <input name="test_name" placeholder="Exame" required className="w-40 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs" />
      <input name="result_value" placeholder="Resultado" required className="w-28 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs" />
      <input name="reference_range" placeholder="Referência (ex: 30 - 100)" className="w-40 rounded border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1.5 text-xs" />
      <button type="submit" className="rounded-md bg-brand px-3 py-1.5 text-xs font-bold text-brand-on">
        Adicionar
      </button>
    </form>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="border-b border-[var(--border-soft)] px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
      {children}
    </th>
  );
}

function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`border-b border-[var(--border-soft)] px-3 py-2.5 ${className}`}>{children}</td>;
}
