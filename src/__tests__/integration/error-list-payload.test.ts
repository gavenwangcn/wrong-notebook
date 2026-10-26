// @vitest-environment node
import { execFileSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ directory: '', databaseUrl: '' }));

vi.mock('@/lib/prisma', async () => {
    const { PrismaClient } = await import('@prisma/client');
    const { mkdtempSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    state.directory = mkdtempSync(join(tmpdir(), 'error-list-payload-'));
    state.databaseUrl = `file:${join(state.directory, 'test.db')}`;
    return { prisma: new PrismaClient({ datasources: { db: { url: state.databaseUrl } } }) };
});
vi.mock('next-auth', () => ({
    getServerSession: vi.fn(async () => ({ user: { email: 'list@example.com' }, expires: '2099-01-01' })),
}));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { GET } from '@/app/api/error-items/list/route';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';

const image = `data:image/png;base64,${'A'.repeat(128 * 1024)}`;
const animation = `<svg>${' '.repeat(64 * 1024)}</svg>`;
const figure = '<svg xmlns="http://www.w3.org/2000/svg"><circle r="5" /></svg>';
const get = (query = '') => GET(new Request(`http://localhost/api/error-items/list?subjectId=math&${query}`));

describe('错题列表大字段与打印回归（真实 SQLite）', () => {
    beforeAll(async () => {
        execFileSync(process.execPath, [path.resolve('node_modules/prisma/build/index.js'), 'migrate', 'deploy'], {
            env: { ...process.env, DATABASE_URL: state.databaseUrl },
            stdio: 'pipe',
        });
        await prisma.user.create({ data: { id: 'reader', email: 'list@example.com', password: 'unused-test-hash' } });
        await prisma.user.create({ data: { id: 'other', email: 'other@example.com', password: 'unused-test-hash' } });
        await prisma.subject.create({ data: { id: 'math', name: '数学', userId: 'reader' } });
        await prisma.knowledgeTag.create({ data: { id: 'tag', name: '方程', subject: 'math' } });
        for (let index = 0; index < 52; index++) {
            await prisma.errorItem.create({
                data: {
                    id: `question-${index}`, userId: 'reader', subjectId: 'math',
                    createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 52 - index)),
                    questionText: `题目 ${index}：求解方程`, originalImageUrl: image,
                    answerText: 'x = 1', analysis: '等式两边同时运算', figureSvg: figure,
                    svgAnimation: animation, svgAnimationEn: animation, ocrText: '完整 OCR',
                    lastPractice: '{"questionText":"历史练习"}',
                    mistakeStatus: 'wrong_attempt', difficultyStars: 3, masteryProbability: 0.8,
                    knowledgePoints: '["旧知识点"]', tags: { connect: { id: 'tag' } },
                },
            });
        }
        await prisma.errorItem.create({ data: { id: 'private', userId: 'other', questionText: '其他用户的题目', originalImageUrl: image } });
        await prisma.practiceRecord.createMany({ data: [
            { userId: 'reader', errorItemId: 'question-0', result: null },
            { userId: 'reader', errorItemId: 'question-1', result: 'correct' },
        ] });
    }, 30_000);

    afterAll(async () => {
        await prisma.$disconnect();
        await rm(state.directory, { recursive: true, force: true });
    });

    it('18 张卡片完整返回且响应小于 12 KiB，不携带原图、解答和动画', async () => {
        const response = await get('page=1&pageSize=18');
        const text = await response.text();
        const data = JSON.parse(text);

        expect(response.status).toBe(200);
        expect(data).toMatchObject({ total: 52, page: 1, pageSize: 18, totalPages: 3 });
        expect(data.items).toHaveLength(18);
        expect(data.items[0]).toMatchObject({
            id: 'question-0', questionText: '题目 0：求解方程', masteryStatus: 'new',
            mistakeStatus: 'wrong_attempt', difficultyStars: 3, tags: [{ name: '方程' }],
        });
        expect(data.items[1].masteryStatus).toBe('mastered');
        for (const item of data.items) {
            for (const field of ['originalImageUrl', 'ocrText', 'answerText', 'analysis', 'figureSvg', 'svgAnimation', 'svgAnimationEn', 'lastPractice', '_count']) {
                expect(Object.keys(item)).not.toContain(field);
            }
        }
        expect(Buffer.byteLength(text)).toBeLessThan(12 * 1024);
    });

    it('第二页保持相同排序、数量和用户范围', async () => {
        const data = await (await get('page=2&pageSize=18')).json();
        expect(data).toMatchObject({ total: 52, page: 2, totalPages: 3 });
        expect(data.items).toHaveLength(18);
        expect(data.items[0].id).toBe('question-18');
        expect(data.items[17].id).toBe('question-35');
    });

    it('不指定错题本时仍然隔离其他用户的题目', async () => {
        const response = await GET(new Request('http://localhost/api/error-items/list?pageSize=100'));
        const data = await response.json();
        expect(data.total).toBe(52);
        expect(data.items).toHaveLength(52);
        expect(data.items.map((item: { id: string }) => item.id)).not.toContain('private');
    });

    it('打印视图保留原图、题干、配图、答案、解析和错题本名称', async () => {
        const response = await get('view=print&pageSize=1');
        const data = await response.json();
        expect(response.status).toBe(200);
        expect(data.items[0]).toMatchObject({
            id: 'question-0', originalImageUrl: image, questionText: '题目 0：求解方程',
            figureSvg: figure, answerText: 'x = 1', analysis: '等式两边同时运算',
            subject: { name: '数学' }, tags: [{ name: '方程' }],
        });
        expect(Object.keys(data.items[0])).not.toContain('svgAnimation');
        expect(Object.keys(data.items[0])).not.toContain('lastPractice');
    });

    it('未登录时不能获取列表或打印内容', async () => {
        vi.mocked(getServerSession).mockResolvedValueOnce(null).mockResolvedValueOnce(null);
        expect((await get()).status).toBe(401);
        expect((await get('view=print')).status).toBe(401);
    });
});
