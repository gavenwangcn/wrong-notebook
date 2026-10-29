import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('mobile-apk-downloads', () => {
    let tmpDir: string;

    beforeEach(() => {
        tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wn-apk-'));
        vi.resetModules();
        process.env.MOBILE_APK_DIR = tmpDir;
    });

    afterEach(() => {
        delete process.env.MOBILE_APK_DIR;
        fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('lists apk files and builds api download url when outside public/dest', async () => {
        fs.writeFileSync(path.join(tmpDir, 'WrongNotebook-Android-Client-Phone-2026.10.19.apk'), 'fake');
        fs.writeFileSync(path.join(tmpDir, 'readme.txt'), 'skip');

        const { listMobileApkDownloads, resolveMobileApkFileName } = await import('@/lib/mobile-apk-downloads');
        const items = listMobileApkDownloads();
        expect(items).toHaveLength(1);
        expect(items[0]?.fileName).toContain('.apk');
        expect(items[0]?.downloadUrl).toMatch(/^\/api\/mobile-downloads\/file\//);

        expect(resolveMobileApkFileName(items[0]!.fileName)).toBe(items[0]!.fileName);
        expect(resolveMobileApkFileName('../evil.apk')).toBeNull();
    });
});
