import { authService } from './auth';

const getApiBase = () => {
    // 优先使用构建时注入的变量
    const envUrl = import.meta.env.VITE_API_URL;
    if (envUrl && envUrl !== 'http://localhost:51947' && envUrl !== '') {
        return envUrl;
    }

    // 如果在生产环境且没有配置，fallback 到相对路径（同域代理模式）
    if (import.meta.env.PROD) {
        return '';
    }
    return 'http://localhost:51947';
};

const API_BASE = getApiBase();
console.log('🚀 FoomClous API_BASE:', API_BASE || '(relative path)');

// 分块大小：50MB（小于 Cloudflare 100MB 限制）
const CHUNK_SIZE = 50 * 1024 * 1024;

export interface FileData {
    id: string;
    name: string;
    stored_name: string;
    type: 'image' | 'video' | 'audio' | 'document' | 'other';
    mime_type: string;
    size: string;
    date: string;
    thumbnailUrl?: string;
    previewUrl: string;
    width?: number;
    height?: number;
    source?: string;
    folder?: string;
    created_at: string;
}

export interface StorageStats {
    server: {
        total: string;
        totalBytes: number;
        used: string;
        usedBytes: number;
        free: string;
        freeBytes: number;
        usedPercent: number;
    };
    foomclous: {
        used: string;
        usedBytes: number;
        fileCount: number;
        usedPercent: number;
    };
}

export interface UploadProgress {
    loaded: number;
    total: number;
    percent: number;
}

// 获取带认证的请求头
function getHeaders(additionalHeaders: Record<string, string> = {}): HeadersInit {
    return {
        ...authService.getAuthHeaders(),
        ...additionalHeaders,
    };
}

class FileAPI {
    // 获取文件列表
    async getFiles(): Promise<FileData[]> {
        const response = await fetch(`${API_BASE}/api/files`, {
            headers: getHeaders(),
        });
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        if (!response.ok) throw new Error('获取文件列表失败');
        return response.json();
    }

    // 获取单个文件
    async getFile(id: string): Promise<FileData> {
        const response = await fetch(`${API_BASE}/api/files/${id}`, {
            headers: getHeaders(),
        });
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        if (!response.ok) throw new Error('获取文件信息失败');
        return response.json();
    }

    // 智能上传：小文件直传，大文件分块上传
    async uploadFile(file: File, onProgress?: (progress: UploadProgress) => void): Promise<{ success: boolean; file: FileData }> {
        // 超过 80MB 使用分块上传（留一些余量）
        if (file.size > 80 * 1024 * 1024) {
            return this.chunkedUpload(file, onProgress);
        }
        return this.simpleUpload(file, onProgress);
    }

    // 简单上传（适用于小文件）
    private simpleUpload(file: File, onProgress?: (progress: UploadProgress) => void): Promise<{ success: boolean; file: FileData }> {
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('file', file);

            // 进度监听
            xhr.upload.addEventListener('progress', (event) => {
                if (event.lengthComputable && onProgress) {
                    onProgress({
                        loaded: event.loaded,
                        total: event.total,
                        percent: Math.round((event.loaded / event.total) * 100),
                    });
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 401) {
                    reject(new Error('UNAUTHORIZED'));
                } else if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        resolve(JSON.parse(xhr.responseText));
                    } catch {
                        reject(new Error('解析响应失败'));
                    }
                } else {
                    reject(new Error(`上传失败: ${xhr.status}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('网络错误'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('上传已取消'));
            });

            xhr.open('POST', `${API_BASE}/api/upload`);

            // 添加认证头
            const token = authService.getToken();
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }

            xhr.send(formData);
        });
    }

    // 分块上传（适用于大文件）
    private async chunkedUpload(file: File, onProgress?: (progress: UploadProgress) => void): Promise<{ success: boolean; file: FileData }> {
        const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
        let uploadedBytes = 0;

        // 1. 初始化上传
        const initResponse = await fetch(`${API_BASE}/api/chunked/init`, {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({
                filename: file.name,
                totalChunks,
                mimeType: file.type || 'application/octet-stream',
                totalSize: file.size,
            }),
        });

        if (initResponse.status === 401) throw new Error('UNAUTHORIZED');
        if (!initResponse.ok) throw new Error('初始化分块上传失败');

        const { uploadId } = await initResponse.json();

        try {
            // 2. 逐个上传分块
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * CHUNK_SIZE;
                const end = Math.min(start + CHUNK_SIZE, file.size);
                const chunk = file.slice(start, end);

                const chunkResponse = await fetch(`${API_BASE}/api/chunked/chunk`, {
                    method: 'POST',
                    headers: getHeaders({
                        'Content-Type': 'application/octet-stream',
                        'X-Upload-Id': uploadId,
                        'X-Chunk-Index': chunkIndex.toString(),
                    }),
                    body: chunk,
                });

                if (chunkResponse.status === 401) throw new Error('UNAUTHORIZED');
                if (!chunkResponse.ok) throw new Error(`上传分块 ${chunkIndex + 1}/${totalChunks} 失败`);

                uploadedBytes += chunk.size;

                if (onProgress) {
                    onProgress({
                        loaded: uploadedBytes,
                        total: file.size,
                        percent: Math.round((uploadedBytes / file.size) * 100),
                    });
                }
            }

            // 3. 完成上传
            const completeResponse = await fetch(`${API_BASE}/api/chunked/complete`, {
                method: 'POST',
                headers: getHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ uploadId }),
            });

            if (completeResponse.status === 401) throw new Error('UNAUTHORIZED');
            if (!completeResponse.ok) throw new Error('完成分块上传失败');

            return completeResponse.json();
        } catch (error) {
            try {
                await fetch(`${API_BASE}/api/chunked/${uploadId}`, {
                    method: 'DELETE',
                    headers: getHeaders(),
                });
            } catch {
                // 忽略取消失败
            }
            throw error;
        }
    }

    // 批量上传
    async uploadFiles(files: File[], onProgress?: (fileIndex: number, progress: UploadProgress) => void): Promise<{ success: boolean; files: FileData[] }> {
        const results: FileData[] = [];

        for (let i = 0; i < files.length; i++) {
            const result = await this.uploadFile(files[i], (progress) => {
                onProgress?.(i, progress);
            });
            if (result.file) {
                results.push(result.file);
            }
        }

        return { success: true, files: results };
    }

    // 删除文件
    async deleteFile(id: string): Promise<{ success: boolean; message: string }> {
        const response = await fetch(`${API_BASE}/api/files/${id}`, {
            method: 'DELETE',
            headers: getHeaders(),
        });
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        if (!response.ok) throw new Error('删除文件失败');
        return response.json();
    }

    // 获取下载 URL (直接链接或签名链接)
    async getDownloadLink(id: string): Promise<string> {
        const response = await fetch(`${API_BASE}/api/files/${id}/download-url`, {
            headers: getHeaders(),
        });
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        if (!response.ok) throw new Error('获取下载链接失败');

        const data = await response.json();
        if (data.isRelative) {
            return `${API_BASE}${data.url}`;
        }
        return data.url;
    }

    // 安全下载文件（使用直接链接，不经过 Blob 缓冲）
    async downloadFile(id: string, fileName: string): Promise<void> {
        try {
            const url = await this.getDownloadLink(id);

            const link = document.createElement('a');
            link.href = url;
            link.download = fileName; // 尝试设置文件名 (对于跨域链接可能无效，但后端已有 Content-Disposition)
            // 如果是同源链接 (local signed url)，download 属性有效
            // 如果是跨域 (OneDrive)，浏览器会根据 URL 或 Headers 决定

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('下载出错:', error);
            throw error;
        }
    }


    // 获取存储统计
    async getStorageStats(): Promise<StorageStats> {
        const response = await fetch(`${API_BASE}/api/storage/stats`, {
            headers: getHeaders(),
        });
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        if (!response.ok) throw new Error('获取存储统计失败');
        return response.json();
    }

    // 获取存储配置
    async getStorageConfig(): Promise<{ provider: string; onedrive: { clientId: string | null; tenantId?: string; hasSecret: boolean; hasRefreshToken: boolean } }> {
        const response = await fetch(`${API_BASE}/api/storage/config`, {
            headers: getHeaders(),
        });
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        if (!response.ok) throw new Error('获取存储配置失败');
        return response.json();
    }

    // 更新 OneDrive 配置
    async updateOneDriveConfig(clientId: string, clientSecret: string, refreshToken: string, tenantId: string = 'common'): Promise<{ success: boolean; message: string }> {
        const response = await fetch(`${API_BASE}/api/storage/config/onedrive`, {
            method: 'PUT',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ clientId, clientSecret, refreshToken, tenantId }),
        });
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        if (!response.ok) throw new Error('更新配置失败');
        return response.json();
    }

    // 切换存储提供商
    async switchStorageProvider(provider: 'local' | 'onedrive'): Promise<{ success: boolean; message: string }> {
        const response = await fetch(`${API_BASE}/api/storage/switch`, {
            method: 'POST',
            headers: getHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ provider }),
        });
        if (response.status === 401) throw new Error('UNAUTHORIZED');
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || '切换存储提供商失败');
        }
        return response.json();
    }

    // 健康检查
    async healthCheck(): Promise<{ status: string; timestamp: string }> {
        const response = await fetch(`${API_BASE}/health`);
        if (!response.ok) throw new Error('健康检查失败');
        return response.json();
    }
}

export const fileApi = new FileAPI();
export default fileApi;
