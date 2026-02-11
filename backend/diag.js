
import { query } from './src/db/index.js';

async function run() {
    try {
        const r1 = await query('SELECT source, storage_account_id, COUNT(*) FROM files GROUP BY source, storage_account_id');
        console.log('--- Files Table ---');
        console.table(r1.rows);

        const r2 = await query('SELECT id, name, is_active FROM storage_accounts');
        console.log('\n--- Storage Accounts ---');
        console.table(r2.rows);

        const r3 = await query('SELECT key, value FROM system_settings WHERE key IN (\'active_storage_provider\', \'active_storage_account\')');
        console.log('\n--- System Settings ---');
        console.table(r3.rows);

    } catch (e) {
        console.error(e);
    } finally {
        process.exit(0);
    }
}

run();
