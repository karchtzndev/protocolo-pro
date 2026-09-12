export interface ExtractedExamResult {
  test_name: string;
  result_value: string;
  reference_range: string | null;
  out_of_range: boolean;
  metodo_extracao: "texto_pdf" | "ia_visao";
}

/** Cada entrada reconhece variações de nomenclatura entre laboratórios brasileiros. */
const MARKERS: { name: string; patterns: RegExp[] }[] = [
  { name: "Vitamina D (25-OH)", patterns: [/vitamina\s*d\s*\(?25[\s-]?oh\)?|25[\s-]?hidroxivitamina\s*d|vit\.?\s*d\b/i] },
  { name: "Vitamina B12", patterns: [/vitamina\s*b\s*-?12|cobalamina/i] },
  { name: "Ácido Fólico", patterns: [/ácido\s*fólico|acido\s*folico|folato/i] },
  { name: "Ferritina", patterns: [/ferritina/i] },
  { name: "Ferro Sérico", patterns: [/ferro\s*sérico|ferro\s*serico|\bferro\b/i] },
  { name: "Hemoglobina", patterns: [/hemoglobina(?!\s*glicada)/i] },
  { name: "Hemoglobina Glicada (HbA1c)", patterns: [/hemoglobina\s*glicada|hba1c|a1c/i] },
  { name: "Glicemia de Jejum", patterns: [/glicemia\s*(de\s*)?jejum|glicose\s*(em\s*)?jejum/i] },
  { name: "Insulina de Jejum", patterns: [/insulina\s*(de\s*)?jejum|insulina\s*basal/i] },
  { name: "HOMA-IR", patterns: [/homa[\s-]?ir/i] },
  { name: "Colesterol Total", patterns: [/colesterol\s*total/i] },
  { name: "HDL", patterns: [/\bhdl\b/i] },
  { name: "LDL", patterns: [/\bldl\b/i] },
  { name: "Não-HDL", patterns: [/não[\s-]?hdl|nao[\s-]?hdl/i] },
  { name: "Triglicerídeos", patterns: [/triglicer[íi]deos?/i] },
  { name: "TSH", patterns: [/\btsh\b/i] },
  { name: "T4 Livre", patterns: [/t4\s*livre/i] },
  { name: "PCR Ultrassensível", patterns: [/pcr\s*(ultra[\s-]?sensível|us|ultrassensível)|proteína\s*c\s*reativa/i] },
  { name: "Cálcio Total", patterns: [/cálcio\s*total|calcio\s*total/i] },
  { name: "Cálcio Iônico", patterns: [/cálcio\s*iônico|calcio\s*ionico/i] },
  { name: "Zinco", patterns: [/\bzinco\b/i] },
];

const VALUE_PATTERN = /([\d]+[.,]?\d*)\s*([a-zµμ%/²³.\w]*)/i;
const RANGE_PATTERN = /(?:valor(?:es)?\s*de\s*referência|v\.?r\.?|referência)\s*[:\-]?\s*([\d.,]+\s*(?:a|até|-|–)\s*[\d.,]+\s*[a-zµμ%/²³.\w]*)/i;
const DATE_PATTERN =
  /(?:data\s*(?:da\s*)?(?:coleta|exame|emiss[ãa]o)|coletado\s*em|emitido\s*em)\s*[:\-]?\s*(\d{2}\/\d{2}\/\d{4})/i;

const MINIMUM_MARKERS_FOR_TEXT_PARSER = 5;

/** Extrai a data do exame (formato dd/mm/aaaa) perto de rótulos comuns de laboratório. */
export function parseExamDate(text: string): string | null {
  const match = DATE_PATTERN.exec(text);
  if (!match) return null;
  const [day, month, year] = match[1].split("/");
  return `${year}-${month}-${day}`;
}

/**
 * Etapa 1 do pipeline híbrido: lê a camada de texto embutida no PDF (sem
 * custo de API). Só é aceita se encontrar pelo menos 5 marcadores completos
 * (nome + valor); abaixo disso, retorna null para o caller decidir o que
 * fazer (hoje: pedir digitação manual — a etapa 2, com o modelo de visão,
 * requer ANTHROPIC_API_KEY e ainda não está conectada neste projeto).
 */
export interface PdfExtractionResult {
  results: ExtractedExamResult[];
  examDate: string | null;
}

export async function extractFromPdfTextLayer(file: File): Promise<PdfExtractionResult | null> {
  if (file.type !== "application/pdf") return null;

  let text: string;
  try {
    const { PDFParse } = await import("pdf-parse");
    const buffer = Buffer.from(await file.arrayBuffer());
    const parser = new PDFParse({ data: buffer });
    text = (await parser.getText()).text;
  } catch {
    return null;
  }

  if (!text || text.trim().length < 20) return null;

  const results = parseMarkersFromText(text);
  if (results.length < MINIMUM_MARKERS_FOR_TEXT_PARSER) return null;

  return { results, examDate: parseExamDate(text) };
}

export function parseMarkersFromText(text: string): ExtractedExamResult[] {
  const lines = text.split(/\r?\n/);
  const results: ExtractedExamResult[] = [];

  for (const marker of MARKERS) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!marker.patterns.some((p) => p.test(line))) continue;

      const searchWindow = [line, lines[i + 1] ?? ""].join(" ");
      const afterName = searchWindow.replace(new RegExp(marker.patterns[0].source, "i"), "");

      const valueMatch = VALUE_PATTERN.exec(afterName);
      if (!valueMatch) continue;

      const rangeMatch = RANGE_PATTERN.exec(searchWindow);
      const referenceRange = rangeMatch ? rangeMatch[1].trim() : null;

      results.push({
        test_name: marker.name,
        result_value: `${valueMatch[1]} ${valueMatch[2] ?? ""}`.trim(),
        reference_range: referenceRange,
        out_of_range: referenceRange ? isOutOfRange(valueMatch[1], referenceRange) : false,
        metodo_extracao: "texto_pdf",
      });
      break;
    }
  }

  return results;
}

/**
 * A avaliação é sempre feita contra a faixa impressa no próprio exame — nunca
 * contra uma tabela interna, porque cada laboratório usa método e referência
 * próprios.
 */
function isOutOfRange(rawValue: string, range: string): boolean {
  const value = Number(rawValue.replace(",", "."));
  const bounds = range.match(/[\d.,]+/g)?.map((n) => Number(n.replace(",", ".")));
  if (!bounds || bounds.length < 2 || Number.isNaN(value)) return false;
  const [min, max] = bounds;
  return value < min || value > max;
}
