
import { query } from './backend/src/db/index.js';

async function checkFiles() {
    try {
        console.log('--- File Statistics ---');
        const stats = await query('SELECT source, storage_account_id IS NULL as no_id, COUNT(*) FROM files GROUP BY source, storage_account_id IS NULL');
        console.table(stats.rows);

        console.log('\n--- Recent OneDrive Files ---');
        const recent = await query('SELECT name, source, storage_account_id FROM files WHERE source = \'onedrive\' ORDER BY created_at DESC LIMIT 5');
        console.table(recent.rows);

        console.log('\n--- Checking Active Account ---');
        const { storageManager } = await import('./backend/src/services/storage.js');
        await storageManager.init();
        console.log('Active Account ID:', storageManager.getActiveAccountId());

        const accounts = await query('SELECT id, name, is_active FROM storage_accounts');
        console.table(accounts.rows);

    } catch (err) {
        console.error('Check failed:', err);
    } finally {
        process.exit();
    }
}

checkFiles();
