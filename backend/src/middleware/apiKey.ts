import { Request, Response, NextFunction } from 'express';
import { randomBytes } from 'crypto';
import { query } from '../db/index.js';

export interface ApiKeyInfo {
    id: string;
    name: string;
    permissions: string[];
}

declare global {
    namespace Express {
        interface Request {
            apiKeyInfo?: ApiKeyInfo;
        }
    }
}

export const validateApiKey = async (req: Request, res: Response, next: NextFunction) => {
    const apiKey = req.headers['x-api-key'] as string;

    if (!apiKey) {
        return res.status(401).json({
            error: 'API Key 必需',
            message: '请在请求头中添加 X-API-Key',
        });
    }

    try {
        const result = await query(
            'SELECT id, name, permissions FROM api_keys WHERE key = $1 AND enabled = true',
            [apiKey]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({
                error: '无效的 API Key',
                message: 'API Key 不存在或已禁用',
            });
        }

        const keyInfo = result.rows[0];
        req.apiKeyInfo = {
            id: keyInfo.id,
            name: keyInfo.name,
            permissions: keyInfo.permissions || ['upload'],
        };

        next();
    } catch (error) {
        console.error('验证 API Key 失败:', error);
        res.status(500).json({ error: '验证 API Key 失败' });
    }
};

// 生成新的 API Key
export const generateApiKey = (): string => {
    return `fc_${randomBytes(36).toString('base64url')}`;
};
