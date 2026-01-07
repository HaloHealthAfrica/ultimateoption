/* eslint-disable no-console */
/**
 * Simple SQL migration runner (Neon/Vercel friendly)
 *
 * Usage:
 *   - set DATABASE_URL in your environment (do NOT hardcode it)
 *   - npm run db:migrate
 */

const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('Missing DATABASE_URL. Set it in your environment and re-run.');
  process.exit(1);
}

const schemaPath = path.join(__dirname, '..', 'src', 'ledger', 'schema.neon.sql');
const sql = fs.readFileSync(schemaPath, 'utf8');

async function main() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('Migration applied successfully.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Migration failed.');
    console.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});



