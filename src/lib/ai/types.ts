// Re-export the Zod-validated type from schema.ts
export type { ParsedQuestionFromSchema as ParsedQuestion } from './schema';
import type { ParsedQuestionFromSchema } from './schema';

// Import and re-export MistakeStatus from the single source of truth
import type { MistakeStatus } from '../mistake-status';
export type { MistakeStatus };

export type DifficultyLevel = 'easy' | 'medium' | 'hard' | 'harder';

/** 年级数字：1-6 小学，7-9 初中，10-12 高中 */
export type GradeLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface ReanswerQuestionResult {
    answerText: string;
    analysis: string;
    knowledgePoints: string[];
    wrongAnswerText: string;
    mistakeAnalysis: string;
    mistakeStatus: MistakeStatus;
    subject?: string; // AI 判断的学科，自定义模板未输出时为空
}

export interface GeogebraAnalysisResult {
    suitable: boolean;
    commands: string[];
    description: string;
}

export type PracticeResult = 'correct' | 'wrong' | 'not_attempted';

export interface MasteryHistoryEntry {
    date: string;            // ISO 时间
    difficulty: DifficultyLevel | string | null;
    result: PracticeResult;
    source: 'practice' | 'exam' | string;
}

export interface MasteryEvaluationInput {
    questionText: string;
    knowledgePoints: string[];
    mistakeStatus?: string | null;
    history: MasteryHistoryEntry[];
    ruleProbability: number; // 0~1，规则公式的参考值
    language?: 'zh' | 'en';
}

export interface MasteryEvaluationResult {
    probability: number; // 0~1
    reason: string;
}

export interface TagSuggestionInput {
    questionText: string;
    answerText?: string | null;
    analysis?: string | null;
    subject: string;          // 中文学科名，如「数学」
    allowedTags: string[];    // 可选知识点（标签库中的精确名称）
    gradeSemester?: string | null;
}

export interface AIService {
    analyzeImage(imageBase64: string, mimeType?: string, language?: 'zh' | 'en', grade?: GradeLevel | null, subject?: string | null, gradeSemester?: string | null): Promise<ParsedQuestionFromSchema>;
    generateSimilarQuestion(originalQuestion: string, knowledgePoints: string[], language?: 'zh' | 'en', difficulty?: DifficultyLevel, gradeSemester?: string | null): Promise<ParsedQuestionFromSchema>;
    reanswerQuestion(questionText: string, language?: 'zh' | 'en', subject?: string | null, imageBase64?: string, gradeSemester?: string | null): Promise<ReanswerQuestionResult>;
    analyzeForGeogebra(questionText: string, answerText: string, analysis: string, previousErrors?: string): Promise<GeogebraAnalysisResult>;
    evaluateMastery(input: MasteryEvaluationInput): Promise<MasteryEvaluationResult>;
    suggestKnowledgeTags(input: TagSuggestionInput): Promise<string[]>;
}

export interface AIConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    // Azure OpenAI 特有字段
    azureDeployment?: string;   // Azure 部署名称
    azureApiVersion?: string;   // API 版本 (如 2024-02-15-preview)
}
