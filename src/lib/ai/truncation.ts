/**
 * 推理模型（如 MiniMax、DeepSeek-R1）会先输出思考过程，思考过长时会把 max_tokens 全部用完，
 * 返回 finish_reason = "length" 且正文为空或只有一半（如配图 SVG 较长时）。
 * 此时用更大的输出上限重试一次；仍没有正文则报明确错误，仍只有部分正文时返回该结果尽力解析。
 */

export const AI_OUTPUT_TRUNCATED = 'AI_OUTPUT_TRUNCATED';

/** 截断后重试使用的输出上限 */
export const TRUNCATION_RETRY_MAX_TOKENS = 32768;

interface ChatCompletionLike {
    choices?: Array<{ finish_reason?: string | null; message?: { content?: string | null } | null }>;
}

/** 是否因输出长度上限被截断 */
function isTruncated(response: ChatCompletionLike | null | undefined): boolean {
    return response?.choices?.[0]?.finish_reason === 'length';
}

/** 是否因输出长度上限被截断且没有任何正文 */
export function isTruncatedWithoutContent(response: ChatCompletionLike | null | undefined): boolean {
    const choice = response?.choices?.[0];
    return !!choice && choice.finish_reason === 'length' && !(choice.message?.content || '').trim();
}

/**
 * 以 maxTokens 调用一次；若因长度截断，用 TRUNCATION_RETRY_MAX_TOKENS 重试一次
 */
export async function withTruncationRetry<T extends ChatCompletionLike>(
    call: (maxTokens: number) => Promise<T>,
    maxTokens: number,
    onRetry?: () => void
): Promise<T> {
    const first = await call(maxTokens);
    if (!isTruncated(first)) {
        return first;
    }
    if (maxTokens >= TRUNCATION_RETRY_MAX_TOKENS) {
        if (isTruncatedWithoutContent(first)) throw new Error(AI_OUTPUT_TRUNCATED);
        return first;
    }
    onRetry?.();
    const second = await call(TRUNCATION_RETRY_MAX_TOKENS);
    if (isTruncatedWithoutContent(second)) {
        throw new Error(AI_OUTPUT_TRUNCATED);
    }
    return second;
}
