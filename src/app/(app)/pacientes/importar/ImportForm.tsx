"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseCsv, rowsToPatients, type ImportRow } from "@/lib/csv";
import { importPatients, type ImportSummary } from "./actions";

export function ImportForm() {
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const text = await file.text();
    const parsed = rowsToPatients(parseCsv(text));
    setRows(parsed);
    setFileName(file.name);
    setSummary(null);
  }

  async function handleImport() {
    if (!rows) return;
    setImporting(true);
    const result = await importPatients(rows);
    setSummary(result);
    setImporting(false);
    setRows(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  const validCount = rows?.filter((r) => !r.error).length ?? 0;
  const invalidCount = (rows?.length ?? 0) - validCount;

  return (
    <div>
      <div className="mb-5 rounded-xl border border-[var(--border-soft)] bg-[var(--surface)] p-4">
        <p className="mb-3 text-sm text-[var(--ink-soft)]">
          Envie um arquivo CSV com as colunas <b>nome</b>, <b>nascimento</b> (DD/MM/AAAA), <b>telefone</b>,{" "}
          <b>email</b> e <b>objetivo</b> (as duas últimas são opcionais).
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            className="text-sm"
          />
          <a
            href="data:text/csv;charset=utf-8,nome,nascimento,telefone,email,objetivo%0AMaria Silva,15/03/1990,11999998888,maria@example.com,Emagrecimento"
            download="modelo-pacientes.csv"
            className="text-xs font-semibold text-brand underline"
          >
            Baixar modelo
          </a>
        </div>
      </div>

      {summary && (
        <div className="mb-5 rounded-xl border border-success bg-success-soft p-4 text-sm text-success">
          <b>{summary.created} paciente(s) importado(s)</b> com acesso ao portal já criado.
          {summary.failed.length > 0 && (
            <div className="mt-2 text-xs text-warning">
              {summary.failed.length} linha(s) não importada(s):{" "}
              {summary.failed.map((f) => `${f.row} (${f.reason})`).join(", ")}
            </div>
          )}
        </div>
      )}

      {rows && rows.length > 0 && (
        <div className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
            <div>
              <b className="text-sm">{fileName}</b>
              <span className="ml-2 text-xs text-[var(--ink-soft)]">
                {validCount} válido(s){invalidCount > 0 ? `, ${invalidCount} com erro` : ""}
              </span>
            </div>
            <Button disabled={importing || validCount === 0} onClick={handleImport}>
              {importing ? "Importando..." : `Importar ${validCount} paciente(s)`}
            </Button>
          </div>
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--ink-soft)]">
                  <Th>Nome</Th>
                  <Th>Nascimento</Th>
                  <Th>Telefone</Th>
                  <Th>E-mail</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className={r.error ? "bg-danger-soft" : ""}>
                    <td className="border-t border-[var(--border-soft)] px-3 py-2">{r.full_name || "—"}</td>
                    <td className="border-t border-[var(--border-soft)] px-3 py-2">{r.birth_date || "—"}</td>
                    <td className="border-t border-[var(--border-soft)] px-3 py-2">{r.phone || "—"}</td>
                    <td className="border-t border-[var(--border-soft)] px-3 py-2">{r.email || "—"}</td>
                    <td className="border-t border-[var(--border-soft)] px-3 py-2 text-danger">{r.error ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="px-3 py-2 text-[10.5px] font-bold uppercase tracking-wide">{children}</th>;
}
