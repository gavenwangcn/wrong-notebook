import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api-client';
import { getApiErrorMessage, getErrorMessage } from '@/lib/error-message';

describe('错误信息提取', () => {
    it('Error 取 message，其他值转为字符串', () => {
        expect(getErrorMessage(new Error('boom'))).toBe('boom');
        expect(getErrorMessage('plain')).toBe('plain');
        expect(getErrorMessage(404)).toBe('404');
    });

    it('取 ApiError 中后端返回的 message', () => {
        expect(getApiErrorMessage(new ApiError(400, 'Bad Request', { message: 'AI_TIMEOUT_ERROR' }))).toBe('AI_TIMEOUT_ERROR');
    });

    it.each([
        ['普通 Error', new Error('boom')],
        ['响应体为文本', new ApiError(500, 'Server Error', 'oops')],
        ['message 不是字符串', new ApiError(500, 'Server Error', { message: 1 })],
        ['null', null],
    ])('%s 时返回 undefined', (_name, error) => {
        expect(getApiErrorMessage(error)).toBeUndefined();
    });
});
