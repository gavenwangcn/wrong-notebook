import fs from 'node:fs';
import path from 'node:path';

const APK_SUFFIX = '.apk';

/** 对外提供下载的 APK 目录，默认 public/dest（构建后可 cp dist/*.apk public/dest/） */
export function getMobileApkDirectory(): string {
    const configured = process.env.MOBILE_APK_DIR?.trim();
    if (configured) {
        return path.resolve(configured);
    }
    return path.join(process.cwd(), 'public', 'dest');
}

export type MobileApkItem = {
    fileName: string;
    downloadUrl: string;
    sizeBytes: number;
};

function publicDestDirectory(): string {
    return path.join(process.cwd(), 'public', 'dest');
}

export function resolveMobileApkFileName(fileName: string): string | null {
    const base = path.basename(fileName);
    if (base !== fileName || !base.toLowerCase().endsWith(APK_SUFFIX)) {
        return null;
    }
    if (base.includes('..') || base.includes('/') || base.includes('\\')) {
        return null;
    }
    const full = path.join(getMobileApkDirectory(), base);
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
        return null;
    }
    return base;
}

function buildDownloadUrl(fileName: string): string {
    const dir = path.resolve(getMobileApkDirectory());
    const inPublicDest = dir === path.resolve(publicDestDirectory());
    const encoded = encodeURIComponent(fileName);
    if (inPublicDest) {
        return `/dest/${encoded}`;
    }
    return `/api/mobile-downloads/file/${encoded}`;
}

export function listMobileApkDownloads(): MobileApkItem[] {
    const dir = getMobileApkDirectory();
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir)
        .filter((name) => name.toLowerCase().endsWith(APK_SUFFIX) && !name.startsWith('.'))
        .map((fileName) => {
            const full = path.join(dir, fileName);
            const stat = fs.statSync(full);
            return {
                fileName,
                downloadUrl: buildDownloadUrl(fileName),
                sizeBytes: stat.size,
            };
        })
        .sort((a, b) => a.fileName.localeCompare(b.fileName));
}

export function formatApkSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
