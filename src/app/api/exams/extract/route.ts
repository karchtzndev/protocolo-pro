import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractFromPdfTextLayer } from "@/lib/exams/extract";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const patientId = formData.get("patient_id") as string | null;
  if (!file || !patientId) {
    return NextResponse.json({ error: "Arquivo e patient_id são obrigatórios." }, { status: 400 });
  }

  const path = `${patientId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("exams").upload(path, file);
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const {
    data: { publicUrl },
  } = supabase.storage.from("exams").getPublicUrl(path);

  const { data: exam, error: examError } = await supabase
    .from("exams")
    .insert({ patient_id: patientId, file_url: publicUrl, status: "processando" })
    .select()
    .single();
  if (examError) return NextResponse.json({ error: examError.message }, { status: 500 });

  await logAudit(user.id, "exame.enviar", { targetType: "exam", targetId: exam.id, metadata: { fileName: file.name } });

  const results = await extractFromPdfTextLayer(file);

  if (!results) {
    // A imagem/PDF escaneado exigiria a etapa 2 (modelo de visão), ainda não
    // conectada neste projeto — fica pendente de digitação manual.
    await supabase.from("exams").update({ status: "erro" }).eq("id", exam.id);
    return NextResponse.json({
      examId: exam.id,
      results: [],
      warning:
        "Não foi possível ler o texto do PDF automaticamente (comum em PDFs escaneados ou imagens). Digite os marcadores manualmente.",
    });
  }

  const { error: resultsError } = await supabase.from("exam_results").insert(
    results.map((r) => ({ ...r, exam_id: exam.id, confirmed: false }))
  );
  if (resultsError) return NextResponse.json({ error: resultsError.message }, { status: 500 });

  await supabase.from("exams").update({ status: "concluido" }).eq("id", exam.id);

  return NextResponse.json({ examId: exam.id, results });
}
