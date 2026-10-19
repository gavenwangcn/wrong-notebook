import { prisma } from "@/lib/prisma";
import { getAIService } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import type { MasteryHistoryEntry, PracticeResult } from "@/lib/ai/types";

const logger = createLogger('mastery');

/** 掌握概率达到该阈值时自动标记为已掌握 */
export const MASTERY_THRESHOLD = 0.8;

export const PRACTICE_RESULTS: readonly PracticeResult[] = ['correct', 'wrong', 'not_attempted'];

export function isPracticeResult(value: unknown): value is PracticeResult {
    return typeof value === 'string' && (PRACTICE_RESULTS as readonly string[]).includes(value);
}

// 做对时按难度给分：难度越高越能说明掌握
const CORRECT_SCORE: Record<string, number> = { easy: 0.85, medium: 0.95, hard: 1, harder: 1 };
const RESULT_SCORE: Record<Exclude<PracticeResult, 'correct'>, number> = { wrong: 0.1, not_attempted: 0 };
// 每往前一次，权重乘以该系数
const RECENCY_DECAY = 0.7;
// 先验：没有足够记录时向 PRIOR 收缩
const PRIOR = 0.3;
const PRIOR_WEIGHT = 0.5;

/**
 * 规则公式估算掌握概率（0~1），记录按时间从早到晚排列；无记录返回 null
 */
export function computeRuleMastery(history: Pick<MasteryHistoryEntry, 'result' | 'difficulty'>[]): number | null {
    if (history.length === 0) {
        return null;
    }
    let weightedSum = PRIOR * PRIOR_WEIGHT;
    let weightTotal = PRIOR_WEIGHT;
    history.forEach((entry, index) => {
        const weight = Math.pow(RECENCY_DECAY, history.length - 1 - index);
        const score = entry.result === 'correct'
            ? CORRECT_SCORE[entry.difficulty || 'medium'] ?? CORRECT_SCORE.medium
            : RESULT_SCORE[entry.result];
        weightedSum += weight * score;
        weightTotal += weight;
    });
    return Math.round((weightedSum / weightTotal) * 100) / 100;
}

export function masteryLevelFor(probability: number): number {
    return probability >= MASTERY_THRESHOLD ? 1 : 0;
}

/**
 * 重新评估一道错题的掌握概率：优先调用 AI，失败时使用规则公式兜底
 */
export async function evaluateErrorItemMastery(errorItemId: string): Promise<void> {
    const item = await prisma.errorItem.findUnique({
        where: { id: errorItemId },
        select: {
            id: true,
            questionText: true,
            mistakeStatus: true,
            tags: { select: { name: true } },
            practiceRecords: {
                where: { result: { not: null } },
                orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
                select: { result: true, difficulty: true, source: true, createdAt: true },
            },
        },
    });
    if (!item) {
        return;
    }

    const history: MasteryHistoryEntry[] = item.practiceRecords
        .filter((record) => isPracticeResult(record.result))
        .map((record) => ({
            date: record.createdAt.toISOString(),
            difficulty: record.difficulty,
            result: record.result as PracticeResult,
            source: record.source,
        }));

    const ruleProbability = computeRuleMastery(history);
    if (ruleProbability === null) {
        await prisma.errorItem.update({
            where: { id: item.id },
            data: { masteryProbability: null, masteryReason: null, masterySource: null, masteryEvaluatedAt: null },
        });
        return;
    }

    let probability = ruleProbability;
    let reason = '';
    let source: 'ai' | 'rule' = 'rule';
    try {
        const result = await getAIService().evaluateMastery({
            questionText: item.questionText || '',
            knowledgePoints: item.tags.map((tag) => tag.name),
            mistakeStatus: item.mistakeStatus,
            history,
            ruleProbability,
        });
        probability = result.probability;
        reason = result.reason;
        source = 'ai';
    } catch (error) {
        logger.warn({ errorItemId, error: error instanceof Error ? error.message : String(error) }, 'AI mastery evaluation failed, using rule estimate');
        const correct = history.filter((entry) => entry.result === 'correct').length;
        reason = `共练习 ${history.length} 次，做对 ${correct} 次（规则估算）`;
    }

    await prisma.errorItem.update({
        where: { id: item.id },
        data: {
            masteryProbability: probability,
            masteryReason: reason,
            masterySource: source,
            masteryEvaluatedAt: new Date(),
            masteryLevel: masteryLevelFor(probability),
        },
    });
    logger.info({ errorItemId, probability, source }, 'Mastery evaluated');
}

// 后台评估队列：串行执行，同一题重复入队时只评估一次
const pendingIds = new Set<string>();
let running = false;

async function drainQueue(): Promise<void> {
    if (running) return;
    running = true;
    try {
        while (pendingIds.size > 0) {
            const [id] = pendingIds;
            pendingIds.delete(id);
            try {
                await evaluateErrorItemMastery(id);
            } catch (error) {
                logger.error({ errorItemId: id, error }, 'Mastery evaluation failed');
            }
        }
    } finally {
        running = false;
    }
}

/** 将错题加入后台评估队列，不阻塞当前请求 */
export function scheduleMasteryEvaluation(errorItemIds: string[]): void {
    errorItemIds.forEach((id) => pendingIds.add(id));
    void drainQueue();
}
