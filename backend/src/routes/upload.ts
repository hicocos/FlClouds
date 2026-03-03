
import { Router, Request, Response } from 'express';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query } from '../db/index.js';
import { validateApiKey } from '../middleware/apiKey.js';
import { generateThumbnail, getImageDimensions } from '../utils/thumbnail.js';
import { storageManager } from '../services/storage.js';
import { getSignedUrl } from '../middleware/signedUrl.js';
import { getUniqueStoredName } from '../utils/fileUtils.js';

const router = Router();

// 修复中文文件名编码问题
function decodeFilename(filename: string): string {
    try {
        const urlDecoded = decodeURIComponent(filename);
        if (urlDecoded !== filename) {
            return urlDecoded;
        }
    } catch {
        // 解码失败，继续尝试其他方法
    }

    try {
        const bytes = Buffer.from(filename, 'binary');
        const decoded = bytes.toString('utf8');
        if (!decoded.includes('\ufffd') && decoded !== filename) {
            return decoded;
        }
    } catch {
        // 解码失败
    }

    return filename;
}

const TEMP_DIR = path.join(process.cwd(), 'data', 'temp');
if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 配置 multer 存储到临时目录
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname);
        const storedName = `${uuidv4()}${ext}`;
        cb(null, storedName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024 // 2GB limit
    }
});

// 处理上传请求
const handleUpload = async (req: Request, res: Response, source: string = 'web') => {
    if (!req.file) {
        return res.status(400).json({ error: '没有上传文件' });
    }

    const file = req.file;
    const { folder } = req.body;
    const originalName = decodeFilename(file.originalname);
    const mimeType = file.mimetype;
    const size = file.size;
    const tempPath = path.resolve(file.path);

    // 3. 生成唯一的存储文件名
    const activeAccountId = storageManager.getActiveAccountId();
    const storedName = await getUniqueStoredName(originalName, folder || null, activeAccountId);

    console.log(`[Upload] 📁 Received file: ${originalName} (${mimeType}, ${size} bytes)`);
    console.log(`[Upload] 🏠 Local temp path: ${tempPath}`);

    try {
        // 1. 获取当前存储提供商
        const provider = storageManager.getProvider();
        console.log(`[Upload] 🛠️  Current storage provider: ${provider.name}, activeAccountId: ${activeAccountId || 'none (local)'}`);

        // 2. 在保存到永久存储前生成缩略图和获取尺寸
        let thumbnailPath = null;
        let width = null;
        let height = null;

        if (mimeType.startsWith('image/') || mimeType.startsWith('video/')) {
            try {
                const thumbResult = await generateThumbnail(tempPath, storedName, mimeType);
                if (thumbResult) {
                    thumbnailPath = path.basename(thumbResult);
                    console.log(`[Upload] ✨ Thumbnail generated: ${thumbnailPath}`);
                    const dims = await getImageDimensions(tempPath, mimeType);
                    width = dims.width;
                    height = dims.height;
                } else {
                    console.log(`[Upload] ⚠️  No thumbnail generated for: ${mimeType}`);
                }
            } catch (error) {
                console.error('生成缩略图失败:', error);
            }
        }

        // 3. 保存到永久存储
        let storedPath = '';
        try {
            storedPath = await provider.saveFile(tempPath, storedName, mimeType);
        } catch (err) {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            throw err;
        }

        // 清理临时文件
        if (fs.existsSync(tempPath)) {
            try {
                fs.unlinkSync(tempPath);
            } catch (e) {
                console.warn('Failed to clean up temp file:', e);
            }
        }

        let type = 'other';
        if (mimeType.startsWith('image/')) type = 'image';
        else if (mimeType.startsWith('video/')) type = 'video';
        else if (mimeType.startsWith('audio/')) type = 'audio';
        else if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text') ||
            mimeType.includes('word') || mimeType.includes('excel') || mimeType.includes('spreadsheet') ||
            mimeType.includes('powerpoint') || mimeType.includes('presentation') ||
            mimeType.includes('markdown') || mimeType.includes('json') || mimeType.includes('xml') ||
            mimeType.includes('sql')) type = 'document';

        const result = await query(
            `INSERT INTO files 
            (name, stored_name, type, mime_type, size, path, thumbnail_path, width, height, source, folder, storage_account_id) 
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) 
            RETURNING id, created_at, name, type, size`,
            [originalName, storedName, type, mimeType, size, storedPath, thumbnailPath, width, height, provider.name, folder || null, activeAccountId]
        );

        const newFile = result.rows[0];

        res.json({
            success: true,
            file: {
                id: newFile.id,
                name: newFile.name,
                type: newFile.type,
                size: newFile.size,
                thumbnailUrl: thumbnailPath ? getSignedUrl(newFile.id, 'thumbnail') : undefined,
                previewUrl: getSignedUrl(newFile.id, 'preview'),
                date: newFile.created_at,
                source: provider.name
            }
        });
    } catch (error) {
        console.error('上传处理失败:', error);
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
        res.status(500).json({ error: '文件上传失败' });
    }
};

// 内部上传接口（前端使用）
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
    await handleUpload(req, res, 'web');
});

// 外部 API 上传接口（需要 API Key）
router.post('/api', validateApiKey, upload.single('file'), async (req: Request, res: Response) => {
    await handleUpload(req, res, 'api');
});

export default router;
