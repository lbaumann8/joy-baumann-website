import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Run with: node --env-file=.env.local scripts/migrate.mjs');
  process.exit(1);
}

const schemaPath = fileURLToPath(new URL('../db/schema.sql', import.meta.url));
const schema = readFileSync(schemaPath, 'utf8');

const sql = neon(process.env.DATABASE_URL);

const statements = schema
  .split(';')
  .map((s) => s.trim())
  .filter(Boolean);

for (const statement of statements) {
  await sql.query(statement);
}

console.log(`Migration complete: ${statements.length} statement(s) applied.`);
