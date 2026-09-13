/** Parser de CSV simples — sem dependência nova. Suporta campos entre aspas com vírgula/ponto-e-vírgula dentro. */
export function parseCsv(text: string): string[][] {
  const delimiter = text.slice(0, text.indexOf("\n")).includes(";") ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.some((f) => f !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === delimiter) {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field || row.length) pushRow();

  return rows;
}

export interface ImportRow {
  full_name: string;
  birth_date: string;
  phone: string;
  email: string;
  objective: string;
  error?: string;
}

const HEADER_ALIASES: Record<string, keyof Omit<ImportRow, "error">> = {
  nome: "full_name",
  "nome completo": "full_name",
  nascimento: "birth_date",
  "data de nascimento": "birth_date",
  telefone: "phone",
  celular: "phone",
  "e-mail": "email",
  email: "email",
  objetivo: "objective",
};

/** Converte DD/MM/AAAA ou AAAA-MM-DD para o formato ISO que o Postgres espera. */
function normalizeDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (match) {
    const [, d, m, y] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return value;
}

export function rowsToPatients(rows: string[][]): ImportRow[] {
  if (!rows.length) return [];

  const [headerRow, ...dataRows] = rows;
  const columns = headerRow.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);

  return dataRows.map((cells) => {
    const record: Partial<ImportRow> = { full_name: "", birth_date: "", phone: "", email: "", objective: "" };
    columns.forEach((key, i) => {
      if (key) record[key] = cells[i] ?? "";
    });

    const full_name = (record.full_name ?? "").trim();
    const birth_date = normalizeDate((record.birth_date ?? "").trim());

    let error: string | undefined;
    if (!full_name) error = "nome ausente";
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(birth_date)) error = "data de nascimento inválida";

    return {
      full_name,
      birth_date,
      phone: (record.phone ?? "").trim(),
      email: (record.email ?? "").trim(),
      objective: (record.objective ?? "").trim(),
      error,
    };
  });
}
