"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireActiveSubscription } from "@/lib/auth/requireActiveSubscription";
import { createPatientAccess } from "@/lib/patientLinks";
import { logAudit } from "@/lib/audit";
import type { ImportRow } from "@/lib/csv";

export interface ImportSummary {
  created: number;
  failed: { row: string; reason: string }[];
}

/**
 * Importação em lote — cada linha vira um paciente + acesso ao portal, igual
 * ao cadastro manual. Continua na próxima linha se uma falhar, em vez de
 * abortar a planilha inteira por causa de uma linha ruim.
 */
export async function importPatients(rows: ImportRow[]): Promise<ImportSummary> {
  const user = await requireActiveSubscription();
  const supabase = await createClient();

  const summary: ImportSummary = { created: 0, failed: [] };

  for (const row of rows) {
    if (row.error) {
      summary.failed.push({ row: row.full_name || "(sem nome)", reason: row.error });
      continue;
    }

    try {
      const { data: patient, error } = await supabase
        .from("patients")
        .insert({
          nutritionist_id: user.id,
          full_name: row.full_name,
          birth_date: row.birth_date,
          phone: row.phone || null,
          email: row.email || null,
          objective: row.objective || null,
          status: "pendente",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      await createPatientAccess(supabase, {
        patientId: patient.id,
        fullName: row.full_name,
        birthDate: row.birth_date,
      });
      summary.created += 1;
    } catch (err) {
      summary.failed.push({ row: row.full_name, reason: err instanceof Error ? err.message : "erro desconhecido" });
    }
  }

  if (summary.created > 0) {
    await logAudit(user.id, "perfil.atualizar", {
      targetType: "patients_import",
      metadata: { created: summary.created, failed: summary.failed.length },
    });
  }

  revalidatePath("/pacientes");
  return summary;
}
