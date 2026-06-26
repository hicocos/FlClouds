import path from 'path';
import { Api } from 'telegram';
import { getFileType, sanitizeFilename } from './telegramUtils.js';
import { getSetting } from './settings.js';

export interface StoragePathOptions {
    source?: string;
    chatName?: string | null;
    folder?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
}

export interface StoragePathRules {
    bySource: boolean;
    byType: boolean;
}

function isEnabled(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined || value === '') return defaultValue;
    return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function shouldClassifyStoragePath(): boolean {
    return isEnabled(process.env.STORAGE_CLASSIFY_BY_PATH, true);
}

export function getTypeFolder(mimeType?: string | null): string {
    const type = getFileType(mimeType || '');
    const map: Record<string, string> = {
        image: 'images',
        video: 'videos',
        audio: 'audio',
        document: 'documents',
        other: 'others',
    };
    return map[type] || 'others';
}

export function getDetailedTypeFolder(mimeType?: string | null, fileName?: string | null): string {
    const lowerMime = (mimeType || '').toLowerCase();
    const ext = path.extname(fileName || '').toLowerCase();
    const installerExts = new Set([
        '.apk', '.apks', '.aab', '.ipa',
        '.exe', '.msi', '.msix', '.appx', '.appxbundle',
        '.dmg', '.pkg', '.deb', '.rpm', '.appimage', '.snap',
        '.run', '.bin', '.sh', '.bat', '.cmd',
        '.iso', '.img',
    ]);
    const archiveExts = new Set(['.zip', '.rar', '.7z', '.tar', '.gz', '.bz2', '.xz']);
    const codeExts = new Set(['.js', '.ts', '.py', '.json', '.xml', '.sql', '.html', '.css', '.java', '.go', '.rs', '.php', '.rb', '.cpp', '.c', '.h']);

    if (
        installerExts.has(ext) ||
        lowerMime.includes('android.package-archive') ||
        lowerMime.includes('apple.installer') ||
        lowerMime.includes('x-msdownload') ||
        lowerMime.includes('x-msi') ||
        lowerMime.includes('x-apple-diskimage') ||
        lowerMime.includes('x-debian-package') ||
        lowerMime.includes('x-rpm') ||
        lowerMime.includes('x-iso9660-image') ||
        lowerMime.includes('executable')
    ) return 'apps';

    if (lowerMime.includes('epub') || lowerMime.includes('mobi') || ['.epub', '.mobi'].includes(ext)) return 'ebooks';
    if (lowerMime.includes('pdf') || ext === '.pdf') return 'pdfs';
    if (lowerMime.includes('zip') || lowerMime.includes('rar') || lowerMime.includes('7z') || lowerMime.includes('tar') || lowerMime.includes('gzip') || lowerMime.includes('compressed') || archiveExts.has(ext)) return 'archives';
    if (lowerMime.includes('spreadsheet') || lowerMime.includes('excel') || ['.xls', '.xlsx', '.csv'].includes(ext)) return 'spreadsheets';
    if (lowerMime.includes('presentation') || lowerMime.includes('powerpoint') || ['.ppt', '.pptx'].includes(ext)) return 'presentations';
    if (lowerMime.includes('word') || ['.doc', '.docx'].includes(ext)) return 'word-docs';
    if (lowerMime.includes('javascript') || lowerMime.includes('typescript') || lowerMime.includes('python') || lowerMime.includes('json') || lowerMime.includes('xml') || lowerMime.includes('sql') || codeExts.has(ext)) return 'code';

    return getTypeFolder(mimeType);
}

export async function getStoragePathRules(): Promise<StoragePathRules> {
    const bySource = await getSetting('storage_path_by_source', process.env.STORAGE_PATH_BY_SOURCE ?? 'true');
    const byType = await getSetting('storage_path_by_type', process.env.STORAGE_PATH_BY_TYPE ?? 'true');
    return {
        bySource: isEnabled(String(bySource ?? 'true'), true),
        byType: isEnabled(String(byType ?? 'true'), true),
    };
}

function normalizeSegment(value: string | null | undefined, fallback: string): string {
    const cleaned = sanitizeFilename((value || fallback).trim()).replace(/^\.+/, '_');
    return cleaned.replace(/^\.+$/, fallback) || fallback;
}

function getEntityDisplayName(entity: any): string | null {
    if (!entity) return null;
    return entity.title || entity.username || [entity.firstName, entity.lastName].filter(Boolean).join(' ') || null;
}

export function getForwardedSourceName(fwdFrom: any): string | null {
    return fwdFrom?.postAuthor || fwdFrom?.fromName || fwdFrom?.savedFromName || null;
}

export function buildStorageFolder(options: StoragePathOptions): string | null {
    return buildStorageFolderWithRules(options, {
        bySource: true,
        byType: true,
    });
}

export function buildStorageFolderWithRules(options: StoragePathOptions, rules: StoragePathRules): string | null {
    if (!shouldClassifyStoragePath()) {
        return options.folder ? normalizeSegment(options.folder, 'folder') : null;
    }

    const segments: string[] = [];
    if (rules.bySource) {
        segments.push(normalizeSegment(options.source, 'uploads'));

        if (options.chatName) {
            segments.push(normalizeSegment(options.chatName, 'chat'));
        }
    }

    if (options.folder) {
        segments.push(normalizeSegment(options.folder, 'folder'));
    }

    if (rules.byType) {
        segments.push(getDetailedTypeFolder(options.mimeType, options.fileName));
    }

    if (segments.length === 0) return null;
    return segments.join('/');
}

export function buildStorageKey(fileName: string, folder?: string | null): string {
    const safeFileName = normalizeSegment(path.basename(fileName), 'file');
    if (!folder) return safeFileName;
    return `${folder.split('/').map(segment => normalizeSegment(segment, 'folder')).join('/')}/${safeFileName}`;
}

export async function getTelegramChatName(message: Api.Message): Promise<string> {
    const fwdFrom = (message as any).fwdFrom;
    const forwardedPeer = fwdFrom?.savedFromPeer || fwdFrom?.fromId;
    if (forwardedPeer) {
        const sourceEntity: any = await (message.client as any)?.getEntity?.(forwardedPeer).catch(() => null);
        const sourceName = getEntityDisplayName(sourceEntity) || getForwardedSourceName(fwdFrom);
        if (sourceName) return normalizeSegment(sourceName, 'telegram');
    }

    const forwardedName = getForwardedSourceName(fwdFrom);
    if (forwardedName) return normalizeSegment(forwardedName, 'telegram');

    const chat: any = await message.getChat().catch(() => null);
    const title = getEntityDisplayName(chat);
    const chatId = message.chatId?.toString();
    return normalizeSegment(title || chatId || 'telegram', 'telegram');
}
