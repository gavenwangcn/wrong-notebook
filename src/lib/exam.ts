import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getAIService } from "@/lib/ai";
import type { DifficultyLevel } from "@/lib/ai/types";
import { createLogger } from "@/lib/logger";
import { startBackgroundTask } from "@/lib/background-tasks";
import type { BackgroundTaskHandle } from "@/lib/background-tasks";

const logger = createLogger('exam');

export const EXAM_SCOPES = ['unmastered', 'mastered', 'all'] as const;
export type ExamScope = typeof EXAM_SCOPES[number];
export const EXAM_DIFFICULTIES = ['easy', 'medium', 'hard', 'harder'] as const;
/** 抽题规则：优先练习较少的题目（默认）/ 完全随机 */
export const EXAM_PICK_RULES = ['least_practiced', 'random'] as const;
export type ExamPickRule = typeof EXAM_PICK_RULES[number];
export const DEFAULT_EXAM_PICK_RULE: ExamPickRule = 'least_practiced';
export const MAX_EXAM_QUESTIONS = 50;

// 同时生成的题目数
const GENERATION_CONCURRENCY = 3;

export interface ExamSelection {
    subjectIds: string[];
    tagNames?: string[];
    scope: ExamScope;
    count: number;
    pickRule?: ExamPickRule;
}

/** 构造抽题条件：限定错题本、掌握范围，可选按知识点标签 */
export function buildSourceWhere(userId: string, selection: ExamSelection): Prisma.ErrorItemWhereInput {
    const where: Prisma.ErrorItemWhereInput = {
        userId,
        subjectId: { in: selection.subjectIds },
        shortId: { not: null },
    };
    if (selection.scope === 'unmastered') {
        where.masteryLevel = 0;
    } else if (selection.scope === 'mastered') {
        where.masteryLevel = { gt: 0 };
    }
    if (selection.tagNames && selection.tagNames.length > 0) {
        where.tags = { some: { name: { in: selection.tagNames } } };
    }
    return where;
}

/** Fisher-Yates 洗牌后取前 count 个 */
export function sampleItems<T>(items: T[], count: number, random: () => number = Math.random): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, count);
}

/** 优先抽练习次数少的题；先洗牌再稳定排序，练习次数相同的题目之间仍随机 */
export function pickLeastPracticed<T extends { practiceCount: number }>(items: T[], count: number, random: () => number = Math.random): T[] {
    return sampleItems(items, items.length, random)
        .sort((a, b) => a.practiceCount - b.practiceCount)
        .slice(0, count);
}

/** 按抽题规则选取原题，练习次数为该题的全部举一反三记录数 */
export async function selectSourceItems(userId: string, selection: ExamSelection) {
    const candidates = await prisma.errorItem.findMany({
        where: buildSourceWhere(userId, selection),
        select: { id: true, shortId: true, _count: { select: { practiceRecords: true } } },
    });
    const items = candidates.map(({ _count, ...item }) => ({ ...item, practiceCount: _count.practiceRecords }));
    return (selection.pickRule ?? DEFAULT_EXAM_PICK_RULE) === 'random'
        ? sampleItems(items, selection.count)
        : pickLeastPracticed(items, selection.count);
}

/** 根据原题全部生成完成情况得出试卷状态 */
export function summarizePaperStatus(statuses: string[]): 'generating' | 'ready' | 'partial' | 'failed' {
    if (statuses.some((status) => status === 'pending')) return 'generating';
    const ready = statuses.filter((status) => status === 'ready').length;
    if (ready === statuses.length) return 'ready';
    return ready === 0 ? 'failed' : 'partial';
}

function parseTagNames(item: { tags: { name: string }[]; knowledgePoints: string | null }): string[] {
    if (item.tags.length > 0) {
        return item.tags.map((tag) => tag.name);
    }
    try {
        const parsed = JSON.parse(item.knowledgePoints || '[]');
        return Array.isArray(parsed) ? parsed.filter((tag): tag is string => typeof tag === 'string') : [];
    } catch {
        return [];
    }
}

async function generateQuestion(questionId: string, difficulty: DifficultyLevel, language: 'zh' | 'en'): Promise<void> {
    const question = await prisma.examQuestion.findUnique({
        where: { id: questionId },
        select: {
            errorItem: {
                select: { questionText: true, knowledgePoints: true, gradeSemester: true, figureSvg: true, tags: { select: { name: true } } },
            },
        },
    });
    if (!question?.errorItem) {
        await prisma.examQuestion.update({ where: { id: questionId }, data: { status: 'failed', error: 'SOURCE_DELETED' } });
        return;
    }

    try {
        const generated = await getAIService().generateSimilarQuestion(
            question.errorItem.questionText || '',
            parseTagNames(question.errorItem),
            language,
            difficulty,
            question.errorItem.gradeSemester,
            question.errorItem.figureSvg
        );
        await prisma.examQuestion.update({
            where: { id: questionId },
            data: {
                status: 'ready',
                questionText: generated.questionText,
                answerText: generated.answerText,
                analysis: generated.analysis,
                figureSvg: generated.figureSvg ?? null,
                error: null,
            },
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        logger.warn({ questionId, error: message }, 'Exam question generation failed');
        await prisma.examQuestion.update({ where: { id: questionId }, data: { status: 'failed', error: message.slice(0, 200) } });
    }
}

const runningPapers = new Set<string>();

/**
 * 生成试卷中尚未成功的题目（新建试卷、重试失败题目、服务重启后续生成均调用此函数）
 */
export async function generateExamPaper(paperId: string, language: 'zh' | 'en' = 'zh'): Promise<void> {
    if (runningPapers.has(paperId)) return;
    runningPapers.add(paperId);
    let task: BackgroundTaskHandle | null = null;
    try {
        const paper = await prisma.examPaper.findUnique({
            where: { id: paperId },
            select: { userId: true, title: true, difficulty: true, questions: { where: { status: { not: 'ready' } }, select: { id: true } } },
        });
        if (!paper) return;

        const queue = paper.questions.map((question) => question.id);
        const total = queue.length;
        let done = 0;
        if (total > 0) task = startBackgroundTask({ userId: paper.userId, kind: 'exam', subject: paper.title, link: `/exams/${paperId}`, total });
        if (queue.length > 0) {
            await prisma.examQuestion.updateMany({ where: { id: { in: queue } }, data: { status: 'pending', error: null } });
            await prisma.examPaper.update({ where: { id: paperId }, data: { status: 'generating' } });
        }
        const worker = async () => {
            while (queue.length > 0) {
                await generateQuestion(queue.shift()!, paper.difficulty as DifficultyLevel, language);
                task?.setProgress(++done, total);
            }
        };
        await Promise.all(Array.from({ length: Math.min(GENERATION_CONCURRENCY, queue.length) }, worker));

        const questions = await prisma.examQuestion.findMany({ where: { paperId }, select: { status: true } });
        const paperStatus = summarizePaperStatus(questions.map((question) => question.status));
        await prisma.examPaper.update({ where: { id: paperId }, data: { status: paperStatus } });
        task?.setProgress(done, total, questions.filter((question) => question.status === 'failed').length);
        if (paperStatus === 'failed') task?.fail('ALL_FAILED');
        else task?.succeed();
    } catch (error) {
        logger.error({ paperId, error }, 'Exam paper generation failed');
        task?.fail(error);
    } finally {
        runningPapers.delete(paperId);
    }
}

/** 是否正在本进程中生成（用于识别服务重启后中断的试卷） */
export function isPaperGenerating(paperId: string): boolean {
    return runningPapers.has(paperId);
}

export interface ExamResultInput {
    questionId: string;
    result: 'correct' | 'wrong' | 'not_attempted' | null;
}

/**
 * 录入试卷结果：同一题可多次录入，每次作为一条新的举一反三记录写入原题历史（未选择结果的题目跳过），
 * 返回需要重新评估掌握概率的原题 ID
 */
export async function recordExamResults(paperId: string, userId: string, takenAt: Date, results: ExamResultInput[]): Promise<string[]> {
    const paper = await prisma.examPaper.findUnique({
        where: { id: paperId },
        select: {
            userId: true,
            difficulty: true,
            questions: {
                select: {
                    id: true,
                    errorItemId: true,
                    questionText: true,
                    answerText: true,
                    analysis: true,
                    figureSvg: true,
                    errorItem: { select: { subject: { select: { name: true } } } },
                },
            },
        },
    });
    if (!paper || paper.userId !== userId) {
        throw new Error('EXAM_NOT_FOUND');
    }

    const questionMap = new Map(paper.questions.map((question) => [question.id, question]));
    const affected = new Set<string>();

    await prisma.$transaction(async (tx) => {
        for (const { questionId, result } of results) {
            const question = questionMap.get(questionId);
            // 原题已删除的题目无法计入举一反三记录
            if (!question?.errorItemId || result === null) continue;

            await tx.practiceRecord.create({
                data: {
                    userId,
                    errorItemId: question.errorItemId,
                    examQuestionId: question.id,
                    source: 'exam',
                    result,
                    isCorrect: result === 'correct',
                    createdAt: takenAt,
                    difficulty: paper.difficulty,
                    subject: question.errorItem?.subject?.name ?? null,
                    questionText: question.questionText,
                    answerText: question.answerText,
                    analysis: question.analysis,
                    figureSvg: question.figureSvg,
                },
            });
            affected.add(question.errorItemId);
        }
        if (affected.size > 0) {
            await tx.examPaper.update({ where: { id: paperId }, data: { resultsRecordedAt: new Date() } });
        }
    });

    return [...affected];
}
