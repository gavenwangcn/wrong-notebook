import { describe, expect, it } from 'vitest';
import { getDefaultPaperLevel } from '@/lib/paper-level';

describe('星级对应的默认卷别', () => {
    it.each([[1, 'a'], [2, 'a'], [3, 'a'], [4, 'b'], [5, 'b']] as const)('%i 星默认归入 %s 卷', (stars, paperLevel) => {
        expect(getDefaultPaperLevel(stars)).toBe(paperLevel);
    });

    it.each([null, undefined, 0, 6, 2.5, NaN])('未评级或无效星级 %s 不自动分类', (stars) => {
        expect(getDefaultPaperLevel(stars)).toBeNull();
    });
});
