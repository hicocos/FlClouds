import { TOTP, NobleCryptoPlugin, ScureBase32Plugin } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { getSetting, setSetting } from './settings.js';

// 初始化 TOTP 实例
const authenticator = new TOTP({
    crypto: new NobleCryptoPlugin(),
    base32: new ScureBase32Plugin(),
});

/**
 * 获取 TOTP 密钥
 * 优先级：环境变量 > 数据库
 */
async function getTOTPSecret(): Promise<string | null> {
    // 1. 检查环境变量
    if (process.env.TOTP_SECRET) {
        return process.env.TOTP_SECRET;
    }

    // 2. 检查数据库
    return await getSetting('totp_secret');
}

/**
 * 检查是否启用了 2FA
 */
export async function is2FAEnabled(): Promise<boolean> {
    const secret = await getTOTPSecret();
    return !!secret;
}

/**
 * 验证 TOTP 令牌
 */
export async function verifyTOTP(token: string): Promise<boolean> {
    const secret = await getTOTPSecret();
    if (!secret) return true; // 如果未启用 2FA，默认验证通过

    try {
        const result = await authenticator.verify(token, {
            secret: secret
        });
        return result.valid;
    } catch (e) {
        console.error('TOTP 验证失败:', e);
        return false;
    }
}

/**
 * 生成 TOTP 设置用的二维码
 * 如果密钥不存在，则自动生成并保存到数据库
 */
export async function generateOTPAuthUrl(user: string = 'Admin'): Promise<string> {
    let secret = await getTOTPSecret();

    if (!secret) {
        // 自动生成密钥 (16字节随机并转为大写 32 位 hex)
        secret = crypto.randomBytes(16).toString('hex').toUpperCase();
        await setSetting('totp_secret', secret);
        console.log('✅ 已为系统自动生成 2FA 密钥并存入数据库');
    }

    const otpauth = authenticator.toURI({
        label: user,
        issuer: 'FoomClous',
        secret: secret
    });

    return await QRCode.toDataURL(otpauth);
}
