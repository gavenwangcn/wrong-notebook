/**
 * 安装包启动器单元测试
 * 覆盖命令行参数解析和 SQLite 地址转换
 */
import path from 'path';
import { createRequire } from 'module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const launcher = require('../../../packaging/runtime/launcher.js') as {
    parseArgs: (argv: string[]) => { port?: string; host?: string; dataDir?: string };
    sqliteUrl: (file: string) => string;
};

describe('package launcher', () => {
    it('解析长短参数和等号写法', () => {
        expect(launcher.parseArgs(['--port', '8080', '-H', '127.0.0.1', '--data-dir=/srv/data'])).toEqual({
            port: '8080',
            host: '127.0.0.1',
            dataDir: '/srv/data',
        });
        expect(launcher.parseArgs(['-p=3001', '-d', 'data'])).toEqual({ port: '3001', dataDir: 'data' });
    });

    it('忽略未知参数', () => {
        expect(launcher.parseArgs(['--verbose', 'start'])).toEqual({});
    });

    it('SQLite 地址使用正斜杠', () => {
        const file = ['data', 'wrong-notebook.db'].join(path.sep);
        expect(launcher.sqliteUrl(file)).toBe('file:data/wrong-notebook.db');
    });
});
