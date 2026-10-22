import { describe, expect, it } from 'vitest';
import { isMasteryStatus, masteryLevelOf, masteryStatusOf } from '@/lib/mastery-status';

describe('masteryStatusOf', () => {
    it('没有举一反三记录时为待复习', () => {
        expect(masteryStatusOf(0, null)).toBe('new');
        expect(masteryStatusOf(0, 0.9)).toBe('new');
    });

    it('有记录且掌握概率低于 50% 时为复习中', () => {
        expect(masteryStatusOf(1, 0.49)).toBe('reviewing');
        // 新记录尚未评估完成时按复习中处理
        expect(masteryStatusOf(2, null)).toBe('reviewing');
    });

    it('有记录且掌握概率达到 50% 时为已掌握', () => {
        expect(masteryStatusOf(1, 0.5)).toBe('mastered');
        expect(masteryStatusOf(3, 0.9)).toBe('mastered');
    });
});

describe('辅助函数', () => {
    it('masteryLevelOf 与 schema 约定一致', () => {
        expect(masteryLevelOf('new')).toBe(0);
        expect(masteryLevelOf('reviewing')).toBe(1);
        expect(masteryLevelOf('mastered')).toBe(2);
    });

    it('isMasteryStatus 只接受三种状态', () => {
        expect(isMasteryStatus('reviewing')).toBe(true);
        expect(isMasteryStatus('1')).toBe(false);
        expect(isMasteryStatus(null)).toBe(false);
    });
});
