import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(__dirname, "..", "supabase", "migrations");

// 0001 e 0002 já foram aplicados anteriormente — só as pendentes ficam aqui.
// Se for rodar em um projeto Supabase novo (do zero), inclua 0001 e 0002 de volta.
const files = [
  "0003_anthropometry.sql",
  "0004_foods_catalog.sql",
  "0005_protocol_draft.sql",
  "0006_supplements_advanced.sql",
  "0007_exam_extraction.sql",
  "0008_audit_and_lgpd.sql",
  "0009_billing_plans.sql",
];

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Defina SUPABASE_DB_URL antes de rodar este script.");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  for (const file of files) {
    const sql = readFileSync(path.join(migrationsDir, file), "utf8");
    console.log(`Aplicando ${file}...`);
    await client.query("begin");
    try {
      await client.query(sql);
      await client.query("commit");
    } catch (err) {
      await client.query("rollback");
      throw new Error(`${file}: ${err.message}`);
    }
    console.log(`OK: ${file}`);
  }
  console.log("Todas as migrations foram aplicadas com sucesso.");
} catch (err) {
  console.error("Falha ao aplicar migrations:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
