import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getAIService } from "@/lib/ai";
import type { DifficultyLevel } from "@/lib/ai/types";
import { createLogger } from "@/lib/logger";

const logger = createLogger('exam');

export const EXAM_SCOPES = ['unmastered', 'mastered', 'all'] as const;
export type ExamScope = typeof EXAM_SCOPES[number];
export const EXAM_DIFFICULTIES = ['easy', 'medium', 'hard', 'harder'] as const;
export const MAX_EXAM_QUESTIONS = 50;

// 同时生成的题目数
const GENERATION_CONCURRENCY = 3;

export interface ExamSelection {
    subjectIds: string[];
    tagNames?: string[];
    scope: ExamScope;
    count: number;
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

/** 随机抽取原题 */
export async function selectSourceItems(userId: string, selection: ExamSelection) {
    const candidates = await prisma.errorItem.findMany({
        where: buildSourceWhere(userId, selection),
        select: { id: true, shortId: true },
    });
    return sampleItems(candidates, selection.count);
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
    try {
        const paper = await prisma.examPaper.findUnique({
            where: { id: paperId },
            select: { difficulty: true, questions: { where: { status: { not: 'ready' } }, select: { id: true } } },
        });
        if (!paper) return;

        const queue = paper.questions.map((question) => question.id);
        if (queue.length > 0) {
            await prisma.examQuestion.updateMany({ where: { id: { in: queue } }, data: { status: 'pending', error: null } });
            await prisma.examPaper.update({ where: { id: paperId }, data: { status: 'generating' } });
        }
        const worker = async () => {
            while (queue.length > 0) {
                await generateQuestion(queue.shift()!, paper.difficulty as DifficultyLevel, language);
            }
        };
        await Promise.all(Array.from({ length: Math.min(GENERATION_CONCURRENCY, queue.length) }, worker));

        const questions = await prisma.examQuestion.findMany({ where: { paperId }, select: { status: true } });
        await prisma.examPaper.update({
            where: { id: paperId },
            data: { status: summarizePaperStatus(questions.map((question) => question.status)) },
        });
    } catch (error) {
        logger.error({ paperId, error }, 'Exam paper generation failed');
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
 * 录入试卷结果：每题结果写入对应原题的举一反三记录（已存在则更新，清空则删除），
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
                    practiceRecordId: true,
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
            if (!question?.errorItemId) continue;

            if (result === null) {
                if (question.practiceRecordId) {
                    await tx.practiceRecord.delete({ where: { id: question.practiceRecordId } });
                    affected.add(question.errorItemId);
                }
                continue;
            }

            const data = { result, isCorrect: result === 'correct', createdAt: takenAt };
            if (question.practiceRecordId) {
                await tx.practiceRecord.update({ where: { id: question.practiceRecordId }, data });
            } else {
                const record = await tx.practiceRecord.create({
                    data: {
                        ...data,
                        userId,
                        errorItemId: question.errorItemId,
                        source: 'exam',
                        difficulty: paper.difficulty,
                        subject: question.errorItem?.subject?.name ?? null,
                        questionText: question.questionText,
                        answerText: question.answerText,
                        analysis: question.analysis,
                        figureSvg: question.figureSvg,
                    },
                });
                await tx.examQuestion.update({ where: { id: questionId }, data: { practiceRecordId: record.id } });
            }
            affected.add(question.errorItemId);
        }
        await tx.examPaper.update({ where: { id: paperId }, data: { resultsRecordedAt: new Date() } });
    });

    return [...affected];
}
