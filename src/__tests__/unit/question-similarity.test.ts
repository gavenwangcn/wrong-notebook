import { describe, expect, it } from 'vitest';
import { calculateQuestionSimilarity, duplicateQuestionSimilarity, normalizeQuestionText } from '@/lib/question-similarity';

describe('完整题干相似度', () => {
    it('规范化全角字符、换行和连续空白', () => {
        expect(duplicateQuestionSimilarity('  求解\nｘ ＋ ２ ＝ ５  ', '求解 x + 2 = 5')).toBe(1);
        expect(normalizeQuestionText('e\u0301')).toBe('é');
    });

    it('不合并空题干，也不丢失大小写、运算符、上下标或英文词间空格', () => {
        for (const [left, right] of [['', ''], [' \n', ' '], ['x²', 'x2'], ['CO₂', 'CO2'], ['A', 'a'], ['x < 1', 'x > 1'], ['now here', 'nowhere']]) {
            expect(duplicateQuestionSimilarity(left, right)).toBeNull();
        }
    });

    it('严格区分等于 99% 和大于 99%', () => {
        expect(duplicateQuestionSimilarity('甲'.repeat(100), '甲'.repeat(99) + '乙')).toBeNull();
        expect(duplicateQuestionSimilarity('甲'.repeat(101), '甲'.repeat(100) + '乙')).toBeCloseTo(100 / 101);
        expect(duplicateQuestionSimilarity('甲'.repeat(200), '甲'.repeat(198) + '乙乙')).toBeNull();
        expect(duplicateQuestionSimilarity('甲'.repeat(201), '甲'.repeat(199) + '乙乙')).toBeCloseTo(199 / 201);
    });

    it('支持自定义阈值及小数阈值，相等时不判重，100% 时不自动判重', () => {
        expect(duplicateQuestionSimilarity('甲'.repeat(100), '甲'.repeat(96) + '乙'.repeat(4), 95)).toBe(0.96);
        expect(duplicateQuestionSimilarity('甲'.repeat(100), '甲'.repeat(95) + '乙'.repeat(5), 95)).toBeNull();
        expect(duplicateQuestionSimilarity('甲'.repeat(1000), '甲'.repeat(996) + '乙'.repeat(4), 99.6)).toBeNull();
        expect(duplicateQuestionSimilarity('同题', '同题', 100)).toBeNull();
    });

    it('手动对比返回低相似度的完整分数', () => {
        expect(calculateQuestionSimilarity('甲乙丙丁', '甲乙戊己')).toBe(0.5);
        expect(calculateQuestionSimilarity('完全不同', '甲乙丙丁')).toBe(0);
        expect(calculateQuestionSimilarity('', '题目')).toBeNull();
        expect(calculateQuestionSimilarity('ｘ = １', 'x = 1')).toBe(1);
    });

    it('比较完整题目，前 100 字相同但后半段不同也应正常导入', () => {
        const prefix = '相同题干'.repeat(25);
        expect(duplicateQuestionSimilarity(prefix + '选项甲'.repeat(40), prefix + '选项乙'.repeat(40))).toBeNull();
    });

    it('支持插入、删除和替换，比较顺序不影响结果', () => {
        const text = '这是完整题目的已知条件。'.repeat(30);
        for (const changed of [text.slice(1), text + '。', text.slice(0, 150) + '新' + text.slice(151)]) {
            expect(duplicateQuestionSimilarity(text, changed)).toBeGreaterThan(0.99);
            expect(duplicateQuestionSimilarity(changed, text)).toBe(duplicateQuestionSimilarity(text, changed));
        }
    });

    it('按 Unicode 字符计算距离，避免表情等字符的代理对影响阈值', () => {
        expect(duplicateQuestionSimilarity('😀'.repeat(100), '😀'.repeat(99) + '😁')).toBeNull();
    });

    it('带状算法与完整编辑距离在不同长度和差异位置上保持一致', () => {
        const distance = (a: string, b: string) => {
            let row = Array.from({ length: b.length + 1 }, (_, index) => index);
            for (let i = 1; i <= a.length; i++) {
                const next = [i];
                for (let j = 1; j <= b.length; j++) {
                    next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
                }
                row = next;
            }
            return row[b.length];
        };
        for (const length of [99, 100, 101, 200, 201, 350]) {
            const text = '甲乙丙丁'.repeat(Math.ceil(length / 4)).slice(0, length);
            for (const position of [0, Math.floor(length / 2), length - 1]) {
                for (const changed of [text.slice(0, position) + text.slice(position + 1), text.slice(0, position) + '新字' + text.slice(position + 1)]) {
                    const edits = distance(text, changed);
                    const maximum = Math.max(text.length, changed.length);
                    const expected = edits * 100 < maximum ? 1 - edits / maximum : null;
                    expect(duplicateQuestionSimilarity(text, changed)).toBe(expected);
                    expect(calculateQuestionSimilarity(text, changed)).toBe(1 - edits / maximum);
                    for (const threshold of [1, 50, 95, 99, 99.5, 99.99, 100]) {
                        const shouldMatch = edits * 10000 < maximum * (10000 - Math.round(threshold * 100));
                        expect(duplicateQuestionSimilarity(text, changed, threshold)).toBe(shouldMatch ? 1 - edits / maximum : null);
                    }
                }
            }
        }
    });
});
