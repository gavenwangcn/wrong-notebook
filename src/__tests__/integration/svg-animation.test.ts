/**
 * /api/error-items/:id/svg-animation 集成测试：生成与删除 SVG 动画讲解；
 * 以及 DELETE /api/error-items/:id/geogebra 删除 GeoGebra 演示
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    user: { findUnique: vi.fn() },
    errorItem: { findUnique: vi.fn(), update: vi.fn() },
    generateSvgAnimation: vi.fn(),
    session: { user: { email: 'user@example.com' }, expires: '2099-01-01' } as { user: { email: string }; expires: string } | null,
}));

vi.mock('@/lib/prisma', () => ({ prisma: { user: mocks.user, errorItem: mocks.errorItem } }));
vi.mock('@/lib/ai', () => ({ getAIService: vi.fn(() => ({ generateSvgAnimation: mocks.generateSvgAnimation })) }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(() => Promise.resolve(mocks.session)) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { POST, DELETE } from '@/app/api/error-items/[id]/svg-animation/route';
import { DELETE as DELETE_GEOGEBRA } from '@/app/api/error-items/[id]/geogebra/route';

const context = { params: Promise.resolve({ id: 'e1' }) };
const generate = () => POST(new Request('http://localhost', { method: 'POST' }), context);
const remove = () => DELETE(new Request('http://localhost', { method: 'DELETE' }), context);
const removeGeogebra = () => DELETE_GEOGEBRA(new Request('http://localhost', { method: 'DELETE' }), context);
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"><animate attributeName="r" from="0" to="4" dur="1s"/></circle></svg>';

describe('SVG 动画讲解接口', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.session = { user: { email: 'user@example.com' }, expires: '2099-01-01' };
        mocks.user.findUnique.mockResolvedValue({ id: 'user-1' });
        mocks.errorItem.findUnique.mockResolvedValue({ userId: 'user-1', questionText: '求面积', answerText: '6', analysis: '底乘高', figureSvg: '<svg/>' });
        mocks.errorItem.update.mockResolvedValue({});
    });

    it('POST 把题目、答案、解析和配图交给 AI，保存生成的动画', async () => {
        mocks.generateSvgAnimation.mockResolvedValue(svg);

        const response = await generate();

        expect(response.status).toBe(200);
        expect(mocks.generateSvgAnimation).toHaveBeenCalledWith('求面积', '6', '底乘高', '<svg/>');
        expect(mocks.errorItem.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { svgAnimation: svg } });
        expect(await response.json()).toEqual({ svgAnimation: svg });
    });

    it('POST 题目文字为空时返回 NO_QUESTION_TEXT，不调用 AI', async () => {
        mocks.errorItem.findUnique.mockResolvedValue({ userId: 'user-1', questionText: '  ', answerText: null, analysis: null, figureSvg: null });

        const response = await generate();

        expect(response.status).toBe(400);
        expect((await response.json()).message).toBe('NO_QUESTION_TEXT');
        expect(mocks.generateSvgAnimation).not.toHaveBeenCalled();
    });

    it('POST AI 未返回有效动画时返回 NO_VALID_ANIMATION，不覆盖已有动画', async () => {
        mocks.generateSvgAnimation.mockResolvedValue(null);

        const response = await generate();

        expect(response.status).toBe(400);
        expect((await response.json()).message).toBe('NO_VALID_ANIMATION');
        expect(mocks.errorItem.update).not.toHaveBeenCalled();
    });

    it('POST AI 报错时返回错误码', async () => {
        mocks.generateSvgAnimation.mockRejectedValue(new Error('AI_TIMEOUT_ERROR'));

        const response = await generate();

        expect(response.status).toBe(500);
        expect((await response.json()).message).toBe('AI_TIMEOUT_ERROR');
    });

    it('DELETE 清空已生成的动画', async () => {
        const response = await remove();

        expect(response.status).toBe(200);
        expect(mocks.errorItem.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { svgAnimation: null } });
    });

    it('未登录返回 401，不能操作他人的题目', async () => {
        mocks.session = null;
        expect((await generate()).status).toBe(401);
        expect((await remove()).status).toBe(401);

        mocks.session = { user: { email: 'user@example.com' }, expires: '2099-01-01' };
        mocks.errorItem.findUnique.mockResolvedValue({ userId: 'other', questionText: '求面积' });
        expect((await generate()).status).toBe(404);
        expect((await remove()).status).toBe(404);
        expect(mocks.errorItem.update).not.toHaveBeenCalled();
        expect(mocks.generateSvgAnimation).not.toHaveBeenCalled();
    });
});

describe('DELETE /api/error-items/:id/geogebra', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.session = { user: { email: 'user@example.com' }, expires: '2099-01-01' };
        mocks.user.findUnique.mockResolvedValue({ id: 'user-1' });
        mocks.errorItem.findUnique.mockResolvedValue({ userId: 'user-1' });
        mocks.errorItem.update.mockResolvedValue({});
    });

    it('清空已生成的 GeoGebra 命令', async () => {
        const response = await removeGeogebra();

        expect(response.status).toBe(200);
        expect(mocks.errorItem.update).toHaveBeenCalledWith({ where: { id: 'e1' }, data: { geogebraCommands: null } });
    });

    it('未登录、题目不存在或属于他人时不删除', async () => {
        mocks.session = null;
        expect((await removeGeogebra()).status).toBe(401);

        mocks.session = { user: { email: 'user@example.com' }, expires: '2099-01-01' };
        mocks.errorItem.findUnique.mockResolvedValue(null);
        expect((await removeGeogebra()).status).toBe(404);

        mocks.errorItem.findUnique.mockResolvedValue({ userId: 'other' });
        expect((await removeGeogebra()).status).toBe(403);
        expect(mocks.errorItem.update).not.toHaveBeenCalled();
    });
});
