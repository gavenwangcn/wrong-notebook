export interface KnowledgeTag {
    id: string;
    name: string;
}

/** 错题详情页使用的错题数据（GET /api/error-items/[id]） */
export interface ErrorItemDetail {
    id: string;
    shortId?: string | null;
    questionText: string;
    answerText: string;
    analysis: string;
    wrongAnswerText?: string | null;
    mistakeAnalysis?: string | null;
    mistakeStatus?: string | null;
    knowledgePoints: string; // 保留兼容旧数据
    tags: KnowledgeTag[]; // 新的标签关联
    masteryLevel: number;
    originalImageUrl: string;
    referenceImageUrl?: string | null;
    wrongAnswerImageUrl?: string | null;
    userNotes: string | null;
    subjectId?: string | null;
    subject?: {
        id: string;
        name: string;
    } | null;
    gradeSemester?: string | null;
    paperLevel?: string | null;
    difficultyStars?: number | null;
    hasFigure?: boolean;
    figureSvg?: string | null;
    geogebraCommands?: string | null;
    svgAnimation?: string | null;    // 中文版动画讲解
    svgAnimationEn?: string | null;  // 英文版动画讲解
}

/** 局部更新错题，同时合并到页面状态 */
export type UpdateErrorItem = (fields: Partial<ErrorItemDetail>) => void;

/** 题目的知识点：优先取标签关联，回退到旧的 knowledgePoints 字段 */
export function getItemTags(item: Pick<ErrorItemDetail, "tags" | "knowledgePoints">): string[] {
    if (item.tags && item.tags.length > 0) {
        return item.tags.map((tag) => tag.name);
    }
    if (item.knowledgePoints) {
        try {
            const parsed = JSON.parse(item.knowledgePoints);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
}
