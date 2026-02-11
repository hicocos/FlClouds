
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function run() {
    try {
        console.log('Using URL:', process.env.DATABASE_URL);
        const r1 = await pool.query('SELECT source, storage_account_id, COUNT(*) FROM files GROUP BY source, storage_account_id');
        console.log('--- Files Table ---');
        console.table(r1.rows);

        const r2 = await pool.query('SELECT id, name, is_active FROM storage_accounts');
        console.log('\n--- Storage Accounts ---');
        console.table(r2.rows);

        const r3 = await pool.query('SELECT key, value FROM system_settings WHERE key IN (\'active_storage_provider\', \'active_storage_account\')');
        console.log('\n--- System Settings ---');
        console.table(r3.rows);

        const r4 = await pool.query('SELECT name, source, storage_account_id, created_at FROM files WHERE source = \'onedrive\' ORDER BY created_at DESC LIMIT 10');
        console.log('\n--- Recent OneDrive Files ---');
        console.table(r4.rows);

    } catch (e) {
        console.error('FAILED:', e.message);
    } finally {
        await pool.end();
        process.exit(0);
    }
}

run();
