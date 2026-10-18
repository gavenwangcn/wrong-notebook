/**
 * 掌握概率计算单元测试
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    update: vi.fn(),
    evaluateMastery: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
    prisma: { errorItem: { findUnique: mocks.findUnique, update: mocks.update } },
}));
vi.mock('@/lib/ai', () => ({
    getAIService: vi.fn(() => ({ evaluateMastery: mocks.evaluateMastery })),
}));
vi.mock('@/lib/logger', () => ({
    createLogger: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
}));

import { MASTERY_THRESHOLD, computeRuleMastery, evaluateErrorItemMastery, isPracticeResult, masteryLevelFor } from '@/lib/mastery';

const record = (result: string, difficulty = 'medium', day = 1) => ({
    result,
    difficulty,
    source: 'practice',
    createdAt: new Date(`2026-10-${String(day).padStart(2, '0')}T00:00:00Z`),
});

describe('computeRuleMastery', () => {
    it('没有记录时返回 null', () => {
        expect(computeRuleMastery([])).toBeNull();
    });

    it('连续做对中等难度达到掌握阈值', () => {
        const history = [1, 2, 3].map(() => ({ result: 'correct' as const, difficulty: 'medium' }));
        expect(computeRuleMastery(history)!).toBeGreaterThanOrEqual(MASTERY_THRESHOLD);
    });

    it('只做对一次时较为保守', () => {
        expect(computeRuleMastery([{ result: 'correct', difficulty: 'medium' }])!).toBeLessThan(MASTERY_THRESHOLD);
    });

    it('近期结果权重更高', () => {
        const recentWrong = computeRuleMastery([
            { result: 'correct', difficulty: 'medium' },
            { result: 'wrong', difficulty: 'medium' },
        ])!;
        const recentCorrect = computeRuleMastery([
            { result: 'wrong', difficulty: 'medium' },
            { result: 'correct', difficulty: 'medium' },
        ])!;
        expect(recentCorrect).toBeGreaterThan(recentWrong);
    });

    it('不会做比做错得分更低', () => {
        const wrong = computeRuleMastery([{ result: 'wrong', difficulty: 'medium' }])!;
        const notAttempted = computeRuleMastery([{ result: 'not_attempted', difficulty: 'medium' }])!;
        expect(notAttempted).toBeLessThan(wrong);
    });

    it('做对更高难度的题得分更高', () => {
        const easy = computeRuleMastery([{ result: 'correct', difficulty: 'easy' }])!;
        const hard = computeRuleMastery([{ result: 'correct', difficulty: 'hard' }])!;
        expect(hard).toBeGreaterThan(easy);
    });
});

describe('辅助函数', () => {
    it('masteryLevelFor 按 80% 阈值判断', () => {
        expect(masteryLevelFor(0.8)).toBe(1);
        expect(masteryLevelFor(0.79)).toBe(0);
    });

    it('isPracticeResult 只接受三种结果', () => {
        expect(isPracticeResult('correct')).toBe(true);
        expect(isPracticeResult('not_attempted')).toBe(true);
        expect(isPracticeResult('unknown')).toBe(false);
    });
});

describe('evaluateErrorItemMastery', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('AI 评估成功时保存 AI 概率并按阈值自动标记', async () => {
        mocks.findUnique.mockResolvedValue({
            id: 'item-1',
            questionText: '题目',
            mistakeStatus: 'wrong_attempt',
            tags: [{ name: '方程' }],
            practiceRecords: [record('correct', 'hard', 1), record('correct', 'hard', 2)],
        });
        mocks.evaluateMastery.mockResolvedValue({ probability: 0.86, reason: '连续做对困难题' });

        await evaluateErrorItemMastery('item-1');

        const input = mocks.evaluateMastery.mock.calls[0][0];
        expect(input.knowledgePoints).toEqual(['方程']);
        expect(input.history).toHaveLength(2);
        expect(mocks.update).toHaveBeenCalledWith({
            where: { id: 'item-1' },
            data: expect.objectContaining({ masteryProbability: 0.86, masterySource: 'ai', masteryLevel: 1, masteryReason: '连续做对困难题' }),
        });
    });

    it('AI 失败时使用规则公式兜底', async () => {
        mocks.findUnique.mockResolvedValue({
            id: 'item-1',
            questionText: '题目',
            mistakeStatus: null,
            tags: [],
            practiceRecords: [record('wrong')],
        });
        mocks.evaluateMastery.mockRejectedValue(new Error('AI_CONNECTION_FAILED'));

        await evaluateErrorItemMastery('item-1');

        const data = mocks.update.mock.calls[0][0].data;
        expect(data.masterySource).toBe('rule');
        expect(data.masteryLevel).toBe(0);
        expect(data.masteryProbability).toBe(computeRuleMastery([{ result: 'wrong', difficulty: 'medium' }]));
    });

    it('记录全部删除后清空掌握概率，不改动掌握状态', async () => {
        mocks.findUnique.mockResolvedValue({ id: 'item-1', questionText: '', mistakeStatus: null, tags: [], practiceRecords: [] });

        await evaluateErrorItemMastery('item-1');

        expect(mocks.evaluateMastery).not.toHaveBeenCalled();
        const data = mocks.update.mock.calls[0][0].data;
        expect(data.masteryProbability).toBeNull();
        expect(data).not.toHaveProperty('masteryLevel');
    });
});
