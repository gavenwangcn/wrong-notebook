/**
 * 推理模型输出截断重试单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { AI_OUTPUT_TRUNCATED, TRUNCATION_RETRY_MAX_TOKENS, isTruncatedWithoutContent, withTruncationRetry } from '@/lib/ai/truncation';

const truncated = { choices: [{ finish_reason: 'length', message: { content: '' } }] };
const answered = { choices: [{ finish_reason: 'stop', message: { content: '答案' } }] };

describe('withTruncationRetry', () => {
    it('正常返回时只调用一次', async () => {
        const call = vi.fn().mockResolvedValue(answered);
        expect(await withTruncationRetry(call, 8192)).toBe(answered);
        expect(call).toHaveBeenCalledTimes(1);
        expect(call).toHaveBeenCalledWith(8192);
    });

    it('思考耗尽额度时用更大的上限重试一次', async () => {
        const call = vi.fn().mockResolvedValueOnce(truncated).mockResolvedValueOnce(answered);
        const onRetry = vi.fn();

        expect(await withTruncationRetry(call, 8192, onRetry)).toBe(answered);
        expect(call.mock.calls.map((args) => args[0])).toEqual([8192, TRUNCATION_RETRY_MAX_TOKENS]);
        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('重试后仍被截断时报 AI_OUTPUT_TRUNCATED', async () => {
        const call = vi.fn().mockResolvedValue(truncated);
        await expect(withTruncationRetry(call, 8192)).rejects.toThrow(AI_OUTPUT_TRUNCATED);
        expect(call).toHaveBeenCalledTimes(2);
    });

    it('有部分正文的截断不视为空结果', () => {
        expect(isTruncatedWithoutContent({ choices: [{ finish_reason: 'length', message: { content: '部分内容' } }] })).toBe(false);
        expect(isTruncatedWithoutContent(truncated)).toBe(true);
    });
});
