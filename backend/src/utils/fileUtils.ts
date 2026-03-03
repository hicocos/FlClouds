import path from 'path';
import { query } from '../db/index.js';
import { sanitizeFilename } from './telegramUtils.js';

/**
 * 获取唯一的存储文件名，如果已存在同名文件则添加数字后缀
 * @param originalName 原始文件名
 * @param folder 文件夹（可选）
 * @param storageAccountId 存储账户 ID（可选，云存储必填）
 * @returns 唯一的存储文件名
 */
export async function getUniqueStoredName(
    originalName: string,
    folder: string | null = null,
    storageAccountId: string | null = null
): Promise<string> {
    // 1. 净化文件名（移除非法字符，限制长度）
    const sanitizedName = sanitizeFilename(originalName);

    const ext = path.extname(sanitizedName);
    const baseName = ext ? sanitizedName.slice(0, -ext.length) : sanitizedName;

    let currentName = sanitizedName;
    let counter = 1;
    let exists = true;

    // 2. 循环检查数据库中是否存在同名文件
    while (exists) {
        let checkQuery = '';
        let params: any[] = [];

        if (storageAccountId) {
            // 云存储：在同一个账户下检查
            checkQuery = 'SELECT COUNT(*)::int as cnt FROM files WHERE stored_name = $1 AND storage_account_id = $2';
            params = [currentName, storageAccountId];
        } else {
            // 本地存储：在 source = 'local' 且文件夹相同的情况下检查
            // 注意：本地通常不分账户，但可能有不同文件夹逻辑，目前代码实现中本地存储的 folder 可能是 null
            checkQuery = 'SELECT COUNT(*)::int as cnt FROM files WHERE stored_name = $1 AND source = \'local\'';
            params = [currentName];
        }

        const result = await query(checkQuery, params);
        const count = result.rows[0]?.cnt || 0;

        if (count === 0) {
            exists = false;
        } else {
            // 已存在，尝试增加序号：name (1).ext
            currentName = `${baseName} (${counter})${ext}`;
            counter++;
        }
    }

    return currentName;
}
