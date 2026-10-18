import { prisma } from "@/lib/prisma";
import { getAIService } from "@/lib/ai";
import { getMathTagsFromDB, getTagsFromDB } from "@/lib/ai/tag-service";
import { calculateGradeNumber, inferSubjectFromName } from "@/lib/knowledge-tags";
import { calculateGrade } from "@/lib/grade-calculator";
import { createLogger } from "@/lib/logger";

const logger = createLogger('retag');

const SUBJECT_DISPLAY_NAMES: Record<string, string> = {
    math: '数学', physics: '物理', chemistry: '化学', biology: '生物', english: '英语',
    chinese: '语文', history: '历史', geography: '地理', politics: '政治',
};

// 批量重新标注时同时处理的题目数
const CONCURRENCY = 2;

export interface RetagResult {
    errorItemId: string;
    tags: string[];
}

/**
 * 用 AI 从当前知识点库中为一道题重新选取知识点：替换原有系统标签，保留自定义标签
 */
export async function retagErrorItem(errorItemId: string, userId: string): Promise<RetagResult> {
    const item = await prisma.errorItem.findUnique({
        where: { id: errorItemId },
        select: {
            userId: true,
            questionText: true,
            answerText: true,
            analysis: true,
            gradeSemester: true,
            subject: { select: { name: true } },
            tags: { select: { id: true, name: true, isSystem: true } },
            user: { select: { educationStage: true, enrollmentYear: true } },
        },
    });
    if (!item || item.userId !== userId) {
        throw new Error('ITEM_NOT_FOUND');
    }
    if (!item.questionText?.trim()) {
        throw new Error('NO_QUESTION_TEXT');
    }

    // 无法从错题本名称判断学科时按数学处理（与识别时的默认行为一致）
    const subjectKey = inferSubjectFromName(item.subject?.name ?? null) || 'math';
    const allowedTags = subjectKey === 'math'
        ? await getMathTagsFromDB(calculateGradeNumber(item.user.educationStage, item.user.enrollmentYear))
        : await getTagsFromDB(subjectKey);
    if (allowedTags.length === 0) {
        throw new Error('NO_AVAILABLE_TAGS');
    }

    const gradeSemester = item.gradeSemester
        || (item.user.educationStage && item.user.enrollmentYear
            ? calculateGrade(item.user.educationStage, item.user.enrollmentYear, new Date(), 'zh')
            : null);

    const chosen = await getAIService().suggestKnowledgeTags({
        questionText: item.questionText,
        answerText: item.answerText,
        analysis: item.analysis,
        subject: SUBJECT_DISPLAY_NAMES[subjectKey],
        allowedTags,
        gradeSemester,
    });
    if (chosen.length === 0) {
        throw new Error('NO_TAGS_SELECTED');
    }

    // 同名系统标签可能出现在多个年级下，取第一个即可（名称相同即同一知识点）
    const systemTags = await prisma.knowledgeTag.findMany({
        where: { isSystem: true, subject: subjectKey, name: { in: chosen } },
        select: { id: true, name: true },
    });
    const tagIdByName = new Map<string, string>();
    for (const tag of systemTags) {
        if (!tagIdByName.has(tag.name)) tagIdByName.set(tag.name, tag.id);
    }
    const newTags = chosen.filter((name) => tagIdByName.has(name));

    const customTags = item.tags.filter((tag) => !tag.isSystem);
    const oldSystemTags = item.tags.filter((tag) => tag.isSystem);
    const tagNames = [...newTags, ...customTags.map((tag) => tag.name).filter((name) => !newTags.includes(name))];

    await prisma.errorItem.update({
        where: { id: errorItemId },
        data: {
            knowledgePoints: JSON.stringify(tagNames),
            tags: {
                disconnect: oldSystemTags.map((tag) => ({ id: tag.id })),
                connect: newTags.map((name) => ({ id: tagIdByName.get(name)! })),
            },
        },
    });

    logger.info({ errorItemId, before: oldSystemTags.map((tag) => tag.name), after: newTags }, 'Error item retagged');
    return { errorItemId, tags: tagNames };
}

export interface RetagJobStatus {
    subjectId: string;
    total: number;
    done: number;
    failed: number;
    running: boolean;
    startedAt: string;
    finishedAt: string | null;
}

// 后台批量任务：按「用户 + 错题本」记录，进程重启后丢失（可重新发起）
const jobs = new Map<string, RetagJobStatus>();
const jobKey = (userId: string, subjectId: string) => `${userId}:${subjectId}`;

export function getRetagJob(userId: string, subjectId: string): RetagJobStatus | null {
    return jobs.get(jobKey(userId, subjectId)) ?? null;
}

/**
 * 在后台为错题本中的全部题目重新生成知识点；同一错题本已在运行时直接返回当前状态
 */
export async function startRetagJob(userId: string, subjectId: string): Promise<RetagJobStatus> {
    const key = jobKey(userId, subjectId);
    const existing = jobs.get(key);
    if (existing?.running) {
        return existing;
    }

    const items = await prisma.errorItem.findMany({
        where: { userId, subjectId },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
    });
    const status: RetagJobStatus = {
        subjectId,
        total: items.length,
        done: 0,
        failed: 0,
        running: items.length > 0,
        startedAt: new Date().toISOString(),
        finishedAt: items.length > 0 ? null : new Date().toISOString(),
    };
    jobs.set(key, status);

    const queue = items.map((item) => item.id);
    const worker = async () => {
        while (queue.length > 0) {
            const id = queue.shift()!;
            try {
                await retagErrorItem(id, userId);
            } catch (error) {
                status.failed++;
                logger.warn({ errorItemId: id, error: error instanceof Error ? error.message : String(error) }, 'Retag failed');
            } finally {
                status.done++;
            }
        }
    };
    void Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker)).finally(() => {
        status.running = false;
        status.finishedAt = new Date().toISOString();
        logger.info({ subjectId, total: status.total, failed: status.failed }, 'Retag job finished');
    });

    return status;
}
