import { describe, expect, it } from 'vitest';
import { normalizeGeneratedQuestion } from '@/lib/ai/generated-question';
import { GENERATED_QUESTION_RULES, generateSimilarQuestionPrompt } from '@/lib/ai/prompts';
import type { ParsedQuestion } from '@/lib/ai/types';

const question = (questionText: string): ParsedQuestion => ({
    questionText, answerText: '4', analysis: '计算得到 4', subject: '数学', knowledgePoints: [],
    wrongAnswerText: '', mistakeAnalysis: '', mistakeStatus: 'unknown', requiresImage: false,
});

describe('生成填空题或解答题', () => {
    it('默认模板和自定义模板都强制使用统一题型规则', () => {
        for (const customTemplate of [undefined, '请沿用原题题型：{{original_question}}']) {
            const prompt = generateSimilarQuestionPrompt('zh', '选择正确答案 A. 2 B. 4', [], 'hard', { customTemplate });
            expect(prompt).toContain(GENERATED_QUESTION_RULES);
            expect(prompt).toContain('只能生成填空题或解答题');
            expect(prompt).not.toContain('包含选项（如果是选择题）');
            expect(prompt.endsWith(GENERATED_QUESTION_RULES)).toBe(true);
        }
    });

    it.each(['第 3 题（5 分）求 2 + 2 的值。', '3. 求 2 + 2 的值。（5分）', 'Question 3: [5 marks] 求 2 + 2 的值。'])('去掉生成题目中的题号和分值：%s', (text) => {
        const result = normalizeGeneratedQuestion(question(text));
        expect(result.questionText).toBe('求 2 + 2 的值。');
        expect(result.answerText).toBe('4');
    });

    it.each(['求和。\nA. 2\nB. 4\nC. 6\nD. 8', '下列正确的是 A. 2 B. 4', '请选择：\n（A）2\n（B）4'])('拒绝带选项的输出，避免直接删除选项造成题目缺条件', (text) => {
        expect(() => normalizeGeneratedQuestion(question(text))).toThrow('AI_RESPONSE_ERROR');
    });

    it.each(['1.5 千克糖分成 3 份，每份多少千克？', '三角形 ABC 中，A、B、C 为顶点，求角 A 的度数。', '求点 A. 的坐标。'])('保留题目的小数和几何字母：%s', (text) => {
        expect(normalizeGeneratedQuestion(question(text)).questionText).toBe(text);
    });
});
