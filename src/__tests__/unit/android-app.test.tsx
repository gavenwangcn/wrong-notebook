import { act } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AndroidAppSetting } from '@/components/settings/android-app-setting';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { androidVersionCode } from '../../../scripts/package/android-version.mjs';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
});

const render = () => act(async () => root.render(<LanguageProvider><AndroidAppSetting /></LanguageProvider>));

describe('AndroidAppSetting', () => {
    it('普通浏览器中不显示', async () => {
        await render();
        expect(container.querySelector('button')).toBeNull();
    });

    it('安卓客户端中显示服务器地址，点击按钮调用原生更换服务器', async () => {
        const changeServer = vi.fn();
        vi.stubGlobal('WrongNotebookAndroid', {
            changeServer,
            getServerUrl: () => 'http://192.168.1.10:3000',
            getDeviceType: () => 'tablet',
        });
        await render();
        expect(container.textContent).toContain('http://192.168.1.10:3000');
        await act(async () => container.querySelector('button')?.click());
        expect(changeServer).toHaveBeenCalledTimes(1);
    });
});

describe('androidVersionCode', () => {
    it('预览版按当天序号计算，正式版排在当天预览版之后', () => {
        expect(androidVersionCode('2026.10.22-1')).toBe(2026102201);
        expect(androidVersionCode('2026.10.22-12')).toBe(2026102212);
        expect(androidVersionCode('2026.10.22')).toBe(2026102299);
        expect(androidVersionCode('2026.10.22')).toBeLessThan(androidVersionCode('2026.10.23-1'));
        expect(androidVersionCode('2026.9.30')).toBeLessThan(androidVersionCode('2026.10.1-1'));
    });

    it('兼容 v 前缀和 git describe 形式', () => {
        expect(androidVersionCode('v2026.1.5-2')).toBe(2026010502);
        expect(androidVersionCode('2026.10.22-3-gabc1234')).toBe(2026102203);
    });

    it('无法识别的版本号或越界序号报错', () => {
        expect(() => androidVersionCode('1.0.0')).toThrow();
        expect(() => androidVersionCode('2026.10.22-99')).toThrow();
    });
});
