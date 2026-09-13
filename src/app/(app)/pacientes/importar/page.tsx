import Link from "next/link";
import { ImportForm } from "./ImportForm";

export default function ImportarPacientesPage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Importar pacientes</h1>
          <p className="mt-1 text-sm text-[var(--ink-soft)]">
            Migrando de outro sistema ou de uma planilha? Importe todos os pacientes de uma vez.
          </p>
        </div>
        <Link href="/pacientes" className="text-sm font-semibold text-brand">
          ← Voltar
        </Link>
      </div>
      <ImportForm />
    </div>
  );
}
