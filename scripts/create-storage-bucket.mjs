import pg from "pg";

const connectionString = process.env.SUPABASE_DB_URL;
if (!connectionString) {
  console.error("Defina SUPABASE_DB_URL antes de rodar este script.");
  process.exit(1);
}

const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });

try {
  await client.connect();
  await client.query(
    `insert into storage.buckets (id, name, public) values ('exams', 'exams', true) on conflict (id) do nothing;`
  );
  console.log("Bucket 'exams' criado (ou já existente).");
} catch (err) {
  console.error("Falha ao criar bucket:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
