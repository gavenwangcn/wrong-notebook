/**
 * 知识点重新生成 API 集成测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    user: { findUnique: vi.fn() },
    errorItem: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    knowledgeTag: { findMany: vi.fn() },
    subject: { findUnique: vi.fn() },
    suggestKnowledgeTags: vi.fn(),
    getMathTagsFromDB: vi.fn(),
    getTagsFromDB: vi.fn(),
    session: { user: { email: 'user@example.com' }, expires: '2099-01-01' },
}));

vi.mock('@/lib/prisma', () => ({
    prisma: { user: mocks.user, errorItem: mocks.errorItem, knowledgeTag: mocks.knowledgeTag, subject: mocks.subject },
}));
vi.mock('@/lib/ai', () => ({ getAIService: vi.fn(() => ({ suggestKnowledgeTags: mocks.suggestKnowledgeTags })) }));
vi.mock('@/lib/ai/tag-service', () => ({ getMathTagsFromDB: mocks.getMathTagsFromDB, getTagsFromDB: mocks.getTagsFromDB }));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(() => Promise.resolve(mocks.session)) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { POST as RETAG_ITEM } from '@/app/api/error-items/[id]/retag/route';
import { GET as JOB_STATUS, POST as START_JOB } from '@/app/api/notebooks/[id]/retag/route';

const params = (id: string) => ({ params: Promise.resolve({ id }) });

const item = {
    userId: 'user-1',
    questionText: '鸡兔同笼，共 10 个头 28 条腿',
    answerText: '鸡 6 兔 4',
    analysis: '假设法',
    gradeSemester: '四年级上',
    subject: { name: '数学' },
    tags: [
        { id: 'old-sys', name: '100以内加法', isSystem: true },
        { id: 'custom-1', name: '易错', isSystem: false },
    ],
    user: { educationStage: 'primary', enrollmentYear: 2023 },
};

describe('知识点重新生成', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.findUnique.mockResolvedValue({ id: 'user-1' });
        mocks.getMathTagsFromDB.mockResolvedValue(['鸡兔同笼', '假设法解鸡兔同笼', '植树问题']);
    });

    it('替换系统标签、保留自定义标签，并按学生年级取数学知识点', async () => {
        mocks.errorItem.findUnique.mockResolvedValue(item);
        mocks.suggestKnowledgeTags.mockResolvedValue(['假设法解鸡兔同笼', '鸡兔同笼']);
        mocks.knowledgeTag.findMany.mockResolvedValue([
            { id: 'tag-a', name: '假设法解鸡兔同笼' },
            { id: 'tag-b', name: '鸡兔同笼' },
            { id: 'tag-b-dup', name: '鸡兔同笼' },
        ]);

        const response = await RETAG_ITEM(new Request('http://localhost', { method: 'POST' }), params('e1'));
        const data = await response.json();

        expect(response.status).toBe(200);
        expect(data.tags).toEqual(['假设法解鸡兔同笼', '鸡兔同笼', '易错']);
        expect(mocks.getMathTagsFromDB).toHaveBeenCalledWith(expect.any(Number));
        expect(mocks.suggestKnowledgeTags.mock.calls[0][0]).toMatchObject({ subject: '数学', gradeSemester: '四年级上' });
        expect(mocks.errorItem.update).toHaveBeenCalledWith({
            where: { id: 'e1' },
            data: {
                knowledgePoints: JSON.stringify(['假设法解鸡兔同笼', '鸡兔同笼', '易错']),
                tags: { disconnect: [{ id: 'old-sys' }], connect: [{ id: 'tag-a' }, { id: 'tag-b' }] },
            },
        });
    });

    it('他人的题目返回 404，AI 未选出知识点时返回 400 且不修改', async () => {
        mocks.errorItem.findUnique.mockResolvedValueOnce({ ...item, userId: 'other' });
        const foreign = await RETAG_ITEM(new Request('http://localhost', { method: 'POST' }), params('e1'));
        expect(foreign.status).toBe(404);

        mocks.errorItem.findUnique.mockResolvedValueOnce(item);
        mocks.suggestKnowledgeTags.mockResolvedValueOnce([]);
        const empty = await RETAG_ITEM(new Request('http://localhost', { method: 'POST' }), params('e1'));
        expect(empty.status).toBe(400);
        expect((await empty.json()).message).toBe('NO_TAGS_SELECTED');
        expect(mocks.errorItem.update).not.toHaveBeenCalled();
    });

    it('AI 错误码透传给前端', async () => {
        mocks.errorItem.findUnique.mockResolvedValue(item);
        mocks.suggestKnowledgeTags.mockRejectedValue(new Error('AI_AUTH_ERROR: invalid key'));

        const response = await RETAG_ITEM(new Request('http://localhost', { method: 'POST' }), params('e1'));

        expect(response.status).toBe(500);
        expect((await response.json()).message).toBe('AI_AUTH_ERROR');
    });

    it('批量任务在后台逐题处理并汇报进度', async () => {
        mocks.subject.findUnique.mockResolvedValue({ userId: 'user-1' });
        mocks.errorItem.findMany.mockResolvedValue([{ id: 'e1' }, { id: 'e2' }]);
        mocks.errorItem.findUnique
            .mockResolvedValueOnce(item)
            .mockResolvedValueOnce({ ...item, questionText: '' });
        mocks.suggestKnowledgeTags.mockResolvedValue(['鸡兔同笼']);
        mocks.knowledgeTag.findMany.mockResolvedValue([{ id: 'tag-b', name: '鸡兔同笼' }]);

        const started = await START_JOB(new Request('http://localhost', { method: 'POST' }), params('nb-1'));
        expect(started.status).toBe(202);
        expect(await started.json()).toMatchObject({ total: 2, running: true });

        await vi.waitFor(async () => {
            const status = await (await JOB_STATUS(new Request('http://localhost'), params('nb-1'))).json();
            expect(status).toMatchObject({ total: 2, done: 2, failed: 1, running: false });
        });
        expect(mocks.errorItem.findMany.mock.calls[0][0].where).toEqual({ userId: 'user-1', subjectId: 'nb-1' });
    });

    it('不能对他人的错题本发起任务', async () => {
        mocks.subject.findUnique.mockResolvedValue({ userId: 'other' });

        const response = await START_JOB(new Request('http://localhost', { method: 'POST' }), params('nb-x'));

        expect(response.status).toBe(404);
        expect(mocks.errorItem.findMany).not.toHaveBeenCalled();
    });
});
