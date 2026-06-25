import { Api, TelegramClient } from 'telegram';
import { query } from '../db/index.js';
import checkDiskSpaceModule from 'check-disk-space';
import os from 'os';
import fs from 'fs';
import { formatBytes, getTypeEmoji } from '../utils/telegramUtils.js';
import {
    MSG,
    buildWelcomeBack,
    buildHelp,
    buildStorageReport,
    buildFileList,
    buildTasksReport,
    buildDeleteSuccess,
} from '../utils/telegramMessages.js';
import { authenticatedUsers, passwordInputState, isAuthenticated } from './telegramState.js';
import { forceStopDownloadTasks, getDownloadQueueStats, getTaskStatus } from './telegramUpload.js';
import { storageManager } from './storage.js';
import { getSetting, setSetting } from '../utils/settings.js';

// ESM compatibility
const checkDiskSpace = (checkDiskSpaceModule as any).default || checkDiskSpaceModule;
const DOWNLOAD_WORKER_OPTIONS = [4, 8, 12, 16];

function normalizeDownloadWorkers(value: unknown): number {
    const parsed = parseInt(String(value ?? '4'), 10);
    return DOWNLOAD_WORKER_OPTIONS.includes(parsed) ? parsed : 4;
}

async function getCurrentDownloadWorkers(): Promise<number> {
    const value = await getSetting('telegram_download_workers', process.env.TELEGRAM_DOWNLOAD_WORKERS || '4');
    return normalizeDownloadWorkers(value);
}

function buildDownloadWorkersKeyboard(current: number, confirmValue?: number): Api.ReplyInlineMarkup {
    if (confirmValue) {
        return new Api.ReplyInlineMarkup({
            rows: [
                new Api.KeyboardButtonRow({
                    buttons: [
                        new Api.KeyboardButtonCallback({ text: `⚠️ 确认使用 ${confirmValue}`, data: Buffer.from(`dw_confirm_${confirmValue}`) }),
                        new Api.KeyboardButtonCallback({ text: '取消', data: Buffer.from('dw_cancel') }),
                    ],
                }),
            ],
        });
    }

    return new Api.ReplyInlineMarkup({
        rows: [
            new Api.KeyboardButtonRow({
                buttons: [
                    new Api.KeyboardButtonCallback({ text: `${current === 4 ? '✅ ' : ''}4`, data: Buffer.from('dw_set_4') }),
                    new Api.KeyboardButtonCallback({ text: `${current === 8 ? '✅ ' : ''}8`, data: Buffer.from('dw_set_8') }),
                ],
            }),
            new Api.KeyboardButtonRow({
                buttons: [
                    new Api.KeyboardButtonCallback({ text: `${current === 12 ? '✅ ' : ''}12 ⚠️`, data: Buffer.from('dw_set_12') }),
                    new Api.KeyboardButtonCallback({ text: `${current === 16 ? '✅ ' : ''}16 ⚠️`, data: Buffer.from('dw_set_16') }),
                ],
            }),
        ],
    });
}

function buildDownloadWorkersText(current: number): string {
    return [
        '⚙️ **Telegram 并发下载设置**',
        '',
        `当前 worker 数：**${current}**`,
        '',
        '说明：Telegram 单次请求上限仍是 512KB，这里调整的是并发分片数量。',
        '',
        '建议：',
        '- `4`：稳定优先',
        '- `8`：速度/稳定平衡',
        '- `12` / `16`：激进模式，可能触发风控、断流、限速，甚至账号风险，需要二次确认',
    ].join('\n');
}

export async function handleStart(message: Api.Message, senderId: number): Promise<void> {
    if (isAuthenticated(senderId)) {
        await message.reply({ message: buildWelcomeBack() });
    } else {
        passwordInputState.set(senderId, { password: '' });
    }
}

export async function handleHelp(message: Api.Message): Promise<void> {
    await message.reply({ message: buildHelp() });
}

export async function handleStorage(message: Api.Message): Promise<void> {
    try {
        const activeAccountId = storageManager.getActiveAccountId();
        const diskPath = os.platform() === 'win32' ? 'C:' : '/';
        const diskSpace = await checkDiskSpace(diskPath);

        // Fetch stats for the active account
        const result = await query(`
            SELECT COUNT(*) as file_count, COALESCE(SUM(size), 0) as total_size 
            FROM files 
            WHERE storage_account_id IS NOT DISTINCT FROM $1
        `, [activeAccountId]);
        const foomclousStats = result.rows[0];
        const totalSize = parseInt(foomclousStats.total_size);
        const fileCount = parseInt(foomclousStats.file_count);
        const usedPercent = Math.round(((diskSpace.size - diskSpace.free) / diskSpace.size) * 100);

        const queueStats = getDownloadQueueStats();

        const reply = buildStorageReport({
            diskTotal: diskSpace.size,
            diskFree: diskSpace.free,
            diskUsedPercent: usedPercent,
            fileCount,
            totalFileSize: totalSize,
            queueActive: queueStats.active,
            queuePending: queueStats.pending,
        });

        await message.reply({ message: reply });
    } catch (error) {
        console.error('🤖 获取存储统计失败:', error);
        await message.reply({ message: MSG.ERR_STORAGE });
    }
}

export async function handleList(message: Api.Message, args: string[]): Promise<void> {
    try {
        let limit = 10;
        if (args.length > 0) {
            const parsed = parseInt(args[0]);
            if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
                limit = parsed;
            }
        }

        const activeAccountId = storageManager.getActiveAccountId();
        const result = await query(`
            SELECT id, name, type, size, folder, created_at 
            FROM files 
            WHERE storage_account_id IS NOT DISTINCT FROM $2
            ORDER BY created_at DESC 
            LIMIT $1
        `, [limit, activeAccountId]);

        if (result.rows.length === 0) {
            await message.reply({ message: MSG.EMPTY_FILES });
            return;
        }

        const reply = buildFileList(result.rows, result.rows.length);
        await message.reply({ message: reply });
    } catch (error) {
        console.error('🤖 获取文件列表失败:', error);
        await message.reply({ message: MSG.ERR_FILE_LIST });
    }
}

export async function handleDelete(message: Api.Message, args: string[]): Promise<void> {
    if (args.length === 0) {
        await message.reply({
            message: '❌ 请提供至少 4 位文件 ID\n\n用法: /delete <ID前缀>\n示例: /delete a1b2c3d4'
        });
        return;
    }

    const fileIdPrefix = args[0].trim();
    if (fileIdPrefix.length < 4) {
        await message.reply({ message: '❌ 请提供至少 4 位文件 ID' });
        return;
    }

    try {
        const activeAccountId = storageManager.getActiveAccountId();
        // 查找匹配的文件
        const result = await query(`
            SELECT id, name, path, thumbnail_path, source, storage_account_id 
            FROM files 
            WHERE id::text LIKE $1 AND storage_account_id IS NOT DISTINCT FROM $2
            LIMIT 1
        `, [fileIdPrefix + '%', activeAccountId]);

        if (result.rows.length === 0) {
            await message.reply({ message: `❌ 未找到 ID 以 "${fileIdPrefix}" 开头的文件` });
            return;
        }

        const file = result.rows[0];

        // 删除实际文件
        const cloudSources = ['onedrive', 'aliyun_oss', 's3', 'webdav', 'google_drive'];
        if (cloudSources.includes(file.source)) {
            try {
                const provider = storageManager.getProvider(`${file.source}:${file.storage_account_id}`);
                await provider.deleteFile(file.path);
            } catch (err) {
                console.warn(`🤖 ${file.source} 文件物理删除失败或文件已不存在:`, err);
            }
        } else if (file.path && fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
        }

        // 删除缩略图
        if (file.thumbnail_path && fs.existsSync(file.thumbnail_path)) {
            fs.unlinkSync(file.thumbnail_path);
        }

        // 从数据库删除记录
        await query(`DELETE FROM files WHERE id = $1`, [file.id]);

        await message.reply({ message: buildDeleteSuccess(file.name, file.id) });
    } catch (error) {
        console.error('🤖 删除文件失败:', error);
        await message.reply({ message: `${MSG.ERR_DELETE}: ${(error as Error).message}` });
    }
}

export async function handleTasks(message: Api.Message): Promise<void> {
    try {
        const status = getTaskStatus();
        const activeCount = status.active.length;
        const pendingCount = status.pending.length;
        const historyCount = status.history.length;

        if (activeCount === 0 && pendingCount === 0 && historyCount === 0) {
            await message.reply({ message: MSG.EMPTY_TASKS });
            return;
        }

        const reply = buildTasksReport(status.active, status.pending, status.history);
        await message.reply({ message: reply });

    } catch (error) {
        console.error('🤖 获取任务列表失败:', error);
        await message.reply({ message: MSG.ERR_TASKS });
    }
}

export async function handleStopTasks(message: Api.Message): Promise<void> {
    try {
        const result = forceStopDownloadTasks('用户通过 /stop_tasks 强制停止');
        if (result.total === 0) {
            await message.reply({ message: '📮 当前没有可停止的下载任务' });
            return;
        }

        await message.reply({
            message: `🛑 已发送停止指令\n\n处理中: ${result.active}\n等待中: ${result.pending}\n\n正在下载的任务会在当前分片结束后停止，并自动清理临时文件。`
        });
    } catch (error) {
        console.error('🤖 强制停止任务失败:', error);
        await message.reply({ message: `❌ 强制停止任务失败: ${(error as Error).message}` });
    }
}

export async function handleDownloadWorkers(message: Api.Message): Promise<void> {
    try {
        const current = await getCurrentDownloadWorkers();
        await message.reply({
            message: buildDownloadWorkersText(current),
            buttons: buildDownloadWorkersKeyboard(current),
        });
    } catch (error) {
        console.error('🤖 获取并发下载设置失败:', error);
        await message.reply({ message: `❌ 获取并发下载设置失败: ${(error as Error).message}` });
    }
}

export async function handleDownloadWorkersCallback(client: TelegramClient, update: Api.UpdateBotCallbackQuery, data: string): Promise<void> {
    const userId = update.userId.toJSNumber();
    if (!isAuthenticated(userId)) {
        await client.invoke(new Api.messages.SetBotCallbackAnswer({
            queryId: update.queryId,
            message: MSG.AUTH_REQUIRED,
            alert: true,
        }));
        return;
    }

    try {
        if (data === 'dw_cancel') {
            const current = await getCurrentDownloadWorkers();
            await client.editMessage(update.peer, {
                message: update.msgId,
                text: buildDownloadWorkersText(current),
                buttons: buildDownloadWorkersKeyboard(current),
            });
            await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: update.queryId, message: '已取消' }));
            return;
        }

        const setMatch = data.match(/^dw_set_(4|8|12|16)$/);
        if (setMatch) {
            const workers = Number(setMatch[1]);
            if (workers >= 12) {
                await client.editMessage(update.peer, {
                    message: update.msgId,
                    text: [
                        `⚠️ **确认使用 ${workers} workers？**`,
                        '',
                        '这是激进并发模式，可能出现：',
                        '- Telegram 风控或限流',
                        '- 下载断流 / 重试增多',
                        '- user session 账号风险，极端情况下可能影响账号',
                        '',
                        '如果只是日常下载，建议使用 4 或 8。',
                    ].join('\n'),
                    buttons: buildDownloadWorkersKeyboard(workers, workers),
                });
                await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: update.queryId, message: '需要二次确认' }));
                return;
            }

            await setSetting('telegram_download_workers', String(workers));
            await client.editMessage(update.peer, {
                message: update.msgId,
                text: `${buildDownloadWorkersText(workers)}\n\n✅ 已切换为 ${workers} workers，后续新下载任务立即生效。`,
                buttons: buildDownloadWorkersKeyboard(workers),
            });
            await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: update.queryId, message: `已设置为 ${workers}` }));
            return;
        }

        const confirmMatch = data.match(/^dw_confirm_(12|16)$/);
        if (confirmMatch) {
            const workers = Number(confirmMatch[1]);
            await setSetting('telegram_download_workers', String(workers));
            await client.editMessage(update.peer, {
                message: update.msgId,
                text: `${buildDownloadWorkersText(workers)}\n\n⚠️ 已确认并切换为 ${workers} workers。若出现断流、限速、风控提示，请立即降回 4 或 8。`,
                buttons: buildDownloadWorkersKeyboard(workers),
            });
            await client.invoke(new Api.messages.SetBotCallbackAnswer({ queryId: update.queryId, message: `已确认 ${workers} workers`, alert: true }));
        }
    } catch (error) {
        console.error('🤖 设置并发下载 worker 失败:', error);
        await client.invoke(new Api.messages.SetBotCallbackAnswer({
            queryId: update.queryId,
            message: `设置失败: ${(error as Error).message}`,
            alert: true,
        }));
    }
}
