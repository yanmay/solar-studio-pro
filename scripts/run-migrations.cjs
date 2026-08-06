// One-off migration runner. Connects via the session pooler using a config
// object (raw password — no URI percent-encoding needed). Runs each .sql file
// in supabase/migrations in filename order, each in its own transaction.
// Usage: SUPABASE_DB_PASSWORD='...' node scripts/run-migrations.cjs
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const password = process.env.SUPABASE_DB_PASSWORD;
if (!password) {
  console.error('SUPABASE_DB_PASSWORD env var is required');
  process.exit(1);
}

const client = new Client({
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.azdgztwjvaikvwlqvchj',
  password,
  ssl: { rejectUnauthorized: false },
});

async function main() {
  const dir = path.join(__dirname, '..', 'supabase', 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  await client.connect();
  console.log(`Connected. Applying ${files.length} migrations...\n`);

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf8');
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('COMMIT');
      console.log(`  OK   ${file}`);
    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`  FAIL ${file}\n       ${err.message}`);
      throw err;
    }
  }

  console.log('\nAll migrations applied.');
  await client.end();
}

main().catch(async (err) => {
  try { await client.end(); } catch {}
  console.error('\nMigration run aborted:', err.message);
  process.exit(1);
});
