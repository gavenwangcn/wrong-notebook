import type { Prisma } from "@prisma/client";

/**
 * 错题的复习状态，由举一反三记录与掌握概率推导：
 * - new（待复习）：还没有举一反三记录
 * - reviewing（复习中）：有记录，掌握概率低于阈值或尚未评估
 * - mastered（已掌握）：有记录，掌握概率达到阈值
 */
export type MasteryStatus = 'new' | 'reviewing' | 'mastered';

export const MASTERY_STATUSES: readonly MasteryStatus[] = ['new', 'reviewing', 'mastered'];

/** 掌握概率达到该阈值视为已掌握 */
export const MASTERY_THRESHOLD = 0.5;

export function isMasteryStatus(value: unknown): value is MasteryStatus {
    return typeof value === 'string' && (MASTERY_STATUSES as readonly string[]).includes(value);
}

// 只有录入了结果的记录才算举一反三记录
const HAS_PRACTICE_RECORDS: Prisma.ErrorItemWhereInput = { practiceRecords: { some: { result: { not: null } } } };

/** 查询某一复习状态的错题条件，合并到其他条件时放进 AND */
export function masteryStatusWhere(status: MasteryStatus): Prisma.ErrorItemWhereInput {
    if (status === 'new') {
        return { practiceRecords: { none: { result: { not: null } } } };
    }
    if (status === 'mastered') {
        return { ...HAS_PRACTICE_RECORDS, masteryProbability: { gte: MASTERY_THRESHOLD } };
    }
    return {
        ...HAS_PRACTICE_RECORDS,
        OR: [{ masteryProbability: null }, { masteryProbability: { lt: MASTERY_THRESHOLD } }],
    };
}

/** 统计举一反三记录数，配合 masteryStatusOf 使用 */
export const PRACTICE_RECORD_COUNT = {
    select: { practiceRecords: { where: { result: { not: null } } } },
} satisfies Prisma.ErrorItemCountOutputTypeDefaultArgs;

export function masteryStatusOf(practiceRecordCount: number, masteryProbability: number | null | undefined): MasteryStatus {
    if (practiceRecordCount === 0) {
        return 'new';
    }
    return typeof masteryProbability === 'number' && masteryProbability >= MASTERY_THRESHOLD ? 'mastered' : 'reviewing';
}

/** 与 schema 中 masteryLevel 的约定一致：0 待复习，1 复习中，2 已掌握 */
export function masteryLevelOf(status: MasteryStatus): number {
    return MASTERY_STATUSES.indexOf(status);
}
