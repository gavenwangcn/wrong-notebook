import { describe, expect, it } from 'vitest';
import { matchAnswer, normalizeAnswer } from '@/lib/answer-match';

describe('normalizeAnswer', () => {
    it('去掉公式符号、空白、结尾标点和"答案是"前缀，全角转半角', () => {
        expect(normalizeAnswer('答案是：$x = 3$。')).toBe('x=3');
        expect(normalizeAnswer('ｘ＝３')).toBe('x=3');
        expect(normalizeAnswer('\\(\\text{H}_2O\\)')).toBe('h_2o');
    });
});

describe('matchAnswer', () => {
    it.each([
        ['x=3', '$x = 3$'],
        ['答：12', '12'],
        ['b', 'B'],
        ['B', 'B. 3 cm'],
        ['(c)', 'C'],
        ['ca', 'AC'],
    ])('%s 与 %s 一致时判对', (user, correct) => {
        expect(matchAnswer(user, correct)).toBe(true);
    });

    it.each([
        // 旧逻辑会把这些判对：答案以学生答案开头或包含学生答案
        ['12', '120'],
        ['x=1', 'x = 1 或 x = -1'],
        ['5', '答案是 15'],
        // 选项不一致、标准答案不是选项时交给 AI
        ['A', 'B'],
        ['bad', 'bad'.toUpperCase() + ' luck'],
        ['abd', 'bad'],
        // 等价但写法不同，本地无法确定
        ['1/2', '0.5'],
        ['', '3'],
    ])('%s 与 %s 不能确定时返回 null', (user, correct) => {
        expect(matchAnswer(user, correct)).toBeNull();
    });
});
