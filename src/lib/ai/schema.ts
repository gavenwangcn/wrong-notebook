import { z } from 'zod';

/**
 * Zod schema for validating AI-parsed questions
 * Ensures type safety and business rule compliance
 */
export const ParsedQuestionSchema = z.object({
    questionText: z.string().min(1, "题目文本不能为空"),
    answerText: z.string().min(1, "答案不能为空"),
    analysis: z.string().min(1, "解析不能为空"),
    wrongAnswerText: z.string().optional().default(""),
    mistakeAnalysis: z.string().optional().default(""),
    mistakeStatus: z.enum(["not_attempted", "wrong_attempt", "unknown"]).optional().default("unknown"),
    subject: z.enum([
        "数学", "物理", "化学", "生物",
        "英语", "语文", "历史", "地理",
        "政治", "其他"
    ]),
    knowledgePoints: z.array(z.string()).max(5, "知识点最多 5 个"),
    requiresImage: z.boolean().optional().default(false), // 题目是否依赖图片（如几何题）
});

/**
 * Type inference from Zod schema
 * Use this type instead of manually defining ParsedQuestion
 */
export type ParsedQuestionFromSchema = z.infer<typeof ParsedQuestionSchema>;

/**
 * Validates and parses AI response JSON
 * @param data - Raw JSON data from AI
 * @returns Validated ParsedQuestion object
 * @throws ZodError if validation fails
 */
export function validateParsedQuestion(data: unknown): ParsedQuestionFromSchema {
    return ParsedQuestionSchema.parse(data);
}

/**
 * Safe validation that returns success/error object
 * @param data - Raw JSON data from AI
 */
export function safeParseParsedQuestion(data: unknown) {
    return ParsedQuestionSchema.safeParse(data);
}

/**
 * AI 掌握概率评估结果：probability 为 0~100 的百分数
 */
export const MasteryEvaluationSchema = z.object({
    probability: z.coerce.number().min(0).max(100),
    reason: z.string().trim().min(1).max(500),
});

/**
 * 从 AI 文本回复中提取 JSON 对象（兼容 markdown 代码块和前后多余文本）
 */
export function extractJsonObject(text: string): unknown {
    let jsonStr = text.trim();
    const blockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (blockMatch) {
        jsonStr = blockMatch[1].trim();
    }
    const start = jsonStr.indexOf('{');
    const end = jsonStr.lastIndexOf('}');
    if (start !== -1 && end > start) {
        jsonStr = jsonStr.substring(start, end + 1);
    }
    return JSON.parse(jsonStr);
}

/**
 * 解析 AI 掌握概率评估回复，返回 0~1 的概率
 */
export function parseMasteryEvaluation(text: string): { probability: number; reason: string } {
    const parsed = MasteryEvaluationSchema.parse(extractJsonObject(text));
    return {
        probability: Math.round(parsed.probability) / 100,
        reason: parsed.reason,
    };
}

/**
 * 规范化 AI 输出的学科名，不在学科列表内时返回 undefined
 */
export function normalizeSubject(value: string | null | undefined): ParsedQuestionFromSchema['subject'] | undefined {
    const parsed = ParsedQuestionSchema.shape.subject.safeParse(value?.trim());
    return parsed.success ? parsed.data : undefined;
}

/** 每题最多选取的知识点数量 */
export const MAX_KNOWLEDGE_TAGS = 5;

/**
 * 解析 AI 选取的知识点，只保留可选清单中存在的标签（去重，最多 5 个）
 */
export function parseTagSuggestion(text: string, allowedTags: string[]): string[] {
    const parsed = z.object({ tags: z.array(z.string()) }).parse(extractJsonObject(text));
    const allowed = new Set(allowedTags);
    const result: string[] = [];
    for (const tag of parsed.tags.map((value) => value.trim())) {
        if (allowed.has(tag) && !result.includes(tag)) {
            result.push(tag);
        }
    }
    return result.slice(0, MAX_KNOWLEDGE_TAGS);
}
