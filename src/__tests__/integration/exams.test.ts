/**
 * /api/exams 错题试卷 API 集成测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
    const tx = {
        practiceRecord: { create: vi.fn(), update: vi.fn(), delete: vi.fn() },
        examQuestion: { update: vi.fn() },
        examPaper: { update: vi.fn() },
    };
    return {
        tx,
        user: { findUnique: vi.fn() },
        subject: { findMany: vi.fn() },
        errorItem: { findMany: vi.fn() },
        examPaper: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
        examQuestion: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
        transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => callback(tx)),
        generateSimilarQuestion: vi.fn(),
        scheduleMasteryEvaluation: vi.fn(),
        session: { user: { email: 'user@example.com' }, expires: '2099-01-01' },
    };
});

vi.mock('@/lib/prisma', () => ({
    prisma: {
        user: mocks.user,
        subject: mocks.subject,
        errorItem: mocks.errorItem,
        examPaper: mocks.examPaper,
        examQuestion: mocks.examQuestion,
        $transaction: mocks.transaction,
    },
}));
vi.mock('@/lib/ai', () => ({ getAIService: vi.fn(() => ({ generateSimilarQuestion: mocks.generateSimilarQuestion })) }));
vi.mock('@/lib/mastery', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/mastery')>()),
    scheduleMasteryEvaluation: mocks.scheduleMasteryEvaluation,
}));
vi.mock('next-auth', () => ({ getServerSession: vi.fn(() => Promise.resolve(mocks.session)) }));
vi.mock('@/lib/auth', () => ({ authOptions: {} }));

import { POST as CREATE, GET as LIST } from '@/app/api/exams/route';
import { GET as DETAIL, DELETE } from '@/app/api/exams/[id]/route';
import { PUT as RESULTS } from '@/app/api/exams/[id]/results/route';
import { generateExamPaper } from '@/lib/exam';

const json = (url: string, method: string, body: object) => new Request(url, {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
});
const params = (id: string) => ({ params: Promise.resolve({ id }) });

describe('/api/exams', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.user.findUnique.mockResolvedValue({ id: 'user-1' });
        // 后台生成在测试中立即结束
        mocks.examPaper.findUnique.mockResolvedValue(null);
    });

    describe('POST 创建试卷', () => {
        const options = { subjectIds: ['s1'], scope: 'unmastered', count: 2, difficulty: 'hard' };

        it('随机抽题并记录来源短 ID', async () => {
            mocks.subject.findMany.mockResolvedValue([{ id: 's1', name: '数学' }]);
            mocks.errorItem.findMany.mockResolvedValue([
                { id: 'e1', shortId: 'AAAAAA' },
                { id: 'e2', shortId: 'BBBBBB' },
                { id: 'e3', shortId: 'CCCCCC' },
            ]);
            mocks.examPaper.create.mockResolvedValue({ id: 'p1', title: '数学', requestedCount: 2, _count: { questions: 2 } });

            const response = await CREATE(json('http://localhost/api/exams', 'POST', options));

            expect(response.status).toBe(201);
            const where = mocks.errorItem.findMany.mock.calls[0][0].where;
            expect(where).toMatchObject({ userId: 'user-1', subjectId: { in: ['s1'] }, masteryLevel: 0 });
            const created = mocks.examPaper.create.mock.calls[0][0].data;
            expect(created.questions.create).toHaveLength(2);
            for (const question of created.questions.create) {
                expect(['AAAAAA', 'BBBBBB', 'CCCCCC']).toContain(question.sourceShortId);
            }
            expect(created).toMatchObject({ userId: 'user-1', scope: 'unmastered', difficulty: 'hard', requestedCount: 2 });
        });

        it('没有符合条件的错题时返回 NO_SOURCE_ITEMS', async () => {
            mocks.subject.findMany.mockResolvedValue([{ id: 's1', name: '数学' }]);
            mocks.errorItem.findMany.mockResolvedValue([]);

            const response = await CREATE(json('http://localhost/api/exams', 'POST', options));

            expect(response.status).toBe(400);
            expect((await response.json()).message).toBe('NO_SOURCE_ITEMS');
        });

        it('不能使用他人的错题本', async () => {
            mocks.subject.findMany.mockResolvedValue([]);

            const response = await CREATE(json('http://localhost/api/exams', 'POST', options));

            expect(response.status).toBe(400);
            expect(mocks.subject.findMany.mock.calls[0][0].where.userId).toBe('user-1');
        });

        it('校验题量与范围', async () => {
            const tooMany = await CREATE(json('http://localhost/api/exams', 'POST', { ...options, count: 51 }));
            const badScope = await CREATE(json('http://localhost/api/exams', 'POST', { ...options, scope: 'some' }));

            expect(tooMany.status).toBe(400);
            expect(badScope.status).toBe(400);
        });
    });

    it('GET 列表返回生成与录入进度', async () => {
        mocks.examPaper.findMany.mockResolvedValue([{
            id: 'p1',
            title: '测试',
            questions: [{ status: 'ready', practiceRecordId: 'r1' }, { status: 'failed', practiceRecordId: null }],
        }]);

        const data = await (await LIST()).json();

        expect(data[0]).toMatchObject({ questionCount: 2, readyCount: 1, recordedCount: 1 });
        expect(data[0]).not.toHaveProperty('questions');
    });

    it('GET 详情不能查看他人的试卷', async () => {
        mocks.examPaper.findUnique.mockResolvedValue({ id: 'p1', userId: 'other', status: 'ready', questions: [] });

        const response = await DETAIL(new Request('http://localhost'), params('p1'));

        expect(response.status).toBe(404);
    });

    it('DELETE 只删除自己的试卷', async () => {
        mocks.examPaper.findUnique.mockResolvedValue({ userId: 'user-1' });

        const response = await DELETE(new Request('http://localhost'), params('p1'));

        expect(response.status).toBe(200);
        expect(mocks.examPaper.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    });

    describe('PUT 录入结果', () => {
        const paper = {
            userId: 'user-1',
            difficulty: 'medium',
            questions: [
                { id: 'q1', errorItemId: 'e1', questionText: '题1', answerText: 'A', analysis: '解1', practiceRecordId: null, errorItem: { subject: { name: '数学' } } },
                { id: 'q2', errorItemId: 'e2', questionText: '题2', answerText: 'B', analysis: '解2', practiceRecordId: 'r2', errorItem: { subject: { name: '数学' } } },
                { id: 'q3', errorItemId: 'e3', questionText: '题3', answerText: 'C', analysis: '解3', practiceRecordId: 'r3', errorItem: null },
                { id: 'q4', errorItemId: null, questionText: '题4', answerText: 'D', analysis: '解4', practiceRecordId: null, errorItem: null },
            ],
        };

        it('新建、更新、删除举一反三记录并触发重新评估', async () => {
            mocks.examPaper.findUnique.mockResolvedValue(paper);
            mocks.tx.practiceRecord.create.mockResolvedValue({ id: 'r1' });

            const response = await RESULTS(json('http://localhost', 'PUT', {
                takenAt: '2026-10-18T04:00:00.000Z',
                results: [
                    { questionId: 'q1', result: 'correct' },
                    { questionId: 'q2', result: 'not_attempted' },
                    { questionId: 'q3', result: null },
                    { questionId: 'q4', result: 'wrong' },
                ],
            }), params('p1'));

            expect(response.status).toBe(200);
            expect(mocks.tx.practiceRecord.create).toHaveBeenCalledWith({
                data: expect.objectContaining({
                    userId: 'user-1',
                    errorItemId: 'e1',
                    source: 'exam',
                    result: 'correct',
                    isCorrect: true,
                    difficulty: 'medium',
                    questionText: '题1',
                    createdAt: new Date('2026-10-18T04:00:00.000Z'),
                }),
            });
            expect(mocks.tx.examQuestion.update).toHaveBeenCalledWith({ where: { id: 'q1' }, data: { practiceRecordId: 'r1' } });
            expect(mocks.tx.practiceRecord.update).toHaveBeenCalledWith({
                where: { id: 'r2' },
                data: { result: 'not_attempted', isCorrect: false, createdAt: new Date('2026-10-18T04:00:00.000Z') },
            });
            expect(mocks.tx.practiceRecord.delete).toHaveBeenCalledWith({ where: { id: 'r3' } });
            // 原题已删除的题目不写记录
            expect(mocks.tx.practiceRecord.create).toHaveBeenCalledTimes(1);
            expect(mocks.scheduleMasteryEvaluation).toHaveBeenCalledWith(['e1', 'e2', 'e3']);
        });

        it('他人的试卷返回 404', async () => {
            mocks.examPaper.findUnique.mockResolvedValue({ ...paper, userId: 'other' });

            const response = await RESULTS(json('http://localhost', 'PUT', { results: [{ questionId: 'q1', result: 'correct' }] }), params('p1'));

            expect(response.status).toBe(404);
            expect(mocks.transaction).not.toHaveBeenCalled();
        });
    });

    describe('generateExamPaper', () => {
        it('逐题生成举一反三题目并汇总试卷状态', async () => {
            mocks.examPaper.findUnique.mockResolvedValue({ difficulty: 'hard', questions: [{ id: 'q1' }, { id: 'q2' }] });
            mocks.examQuestion.findUnique
                .mockResolvedValueOnce({ errorItem: { questionText: '原题1', knowledgePoints: null, gradeSemester: null, tags: [{ name: '函数' }] } })
                .mockResolvedValueOnce({ errorItem: null });
            mocks.generateSimilarQuestion.mockResolvedValue({ questionText: '新题', answerText: '答', analysis: '析' });
            mocks.examQuestion.findMany.mockResolvedValue([{ status: 'ready' }, { status: 'failed' }]);

            await generateExamPaper('p1', 'zh');

            expect(mocks.generateSimilarQuestion).toHaveBeenCalledWith('原题1', ['函数'], 'zh', 'hard', null);
            expect(mocks.examQuestion.update).toHaveBeenCalledWith({
                where: { id: 'q1' },
                data: { status: 'ready', questionText: '新题', answerText: '答', analysis: '析', error: null },
            });
            expect(mocks.examQuestion.update).toHaveBeenCalledWith({ where: { id: 'q2' }, data: { status: 'failed', error: 'SOURCE_DELETED' } });
            expect(mocks.examPaper.update).toHaveBeenLastCalledWith({ where: { id: 'p1' }, data: { status: 'partial' } });
        });
    });
});
