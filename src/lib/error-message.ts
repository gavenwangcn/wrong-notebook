/** 取错误对象的消息，非 Error 时转为字符串 */
export function getErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

/**
 * 取 apiClient 抛出的 ApiError 中后端返回的 message（错误码或提示），没有时返回 undefined。
 * 按结构判断而不用 instanceof，测试中模拟 api-client 时同样可用。
 */
export function getApiErrorMessage(error: unknown): string | undefined {
    if (typeof error !== 'object' || error === null || !('data' in error)) return undefined;
    const { data } = error;
    if (typeof data !== 'object' || data === null || !('message' in data)) return undefined;
    return typeof data.message === 'string' ? data.message : undefined;
}
