import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

export const ACCESS_PASSWORD_HASH = process.env.ACCESS_PASSWORD_HASH || '';
export const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
export const TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;
export const TELEGRAM_USER_API_ID = process.env.TELEGRAM_USER_API_ID || '';
export const TELEGRAM_USER_API_HASH = process.env.TELEGRAM_USER_API_HASH || '';
export const TELEGRAM_USER_SESSION_FILE = process.env.TELEGRAM_USER_SESSION_FILE || './data/telegram_user_session.txt';
export const TELEGRAM_DOWNLOAD_BRIDGE_CHAT_ID = process.env.TELEGRAM_DOWNLOAD_BRIDGE_CHAT_ID || '';
export const TELEGRAM_DOWNLOAD_BRIDGE_ENABLED = !!TELEGRAM_DOWNLOAD_BRIDGE_CHAT_ID;
export const TELEGRAM_DOWNLOAD_WORKERS = Math.max(1, Math.min(16, parseInt(process.env.TELEGRAM_DOWNLOAD_WORKERS || '4', 10) || 4));
export const TELEGRAM_USER_DOWNLOAD_ENABLED = !!TELEGRAM_USER_API_ID && !!TELEGRAM_USER_API_HASH;
