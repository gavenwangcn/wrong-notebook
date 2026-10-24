import { toast } from "@/lib/feedback";
import { translations } from "@/lib/translations";

type RequestOptions = RequestInit & {
    params?: Record<string, string>;
    timeout?: number; // 超时时间（毫秒），默认 60000
};

export class ApiError extends Error {
    constructor(public status: number, public statusText: string, public data: unknown) {
        super(`API Error: ${status} ${statusText}`);
        this.name = 'ApiError';
    }
}

/**
 * 每日 AI 次数用完时统一提示，各个 AI 按钮无需单独处理；
 * 语言与界面一致（LanguageContext 保存在 localStorage 中）。
 */
function notifyAiDailyLimit(data: unknown) {
    if (typeof data !== 'object' || data === null || !('code' in data) || data.code !== 'AI_DAILY_LIMIT_EXCEEDED') return;
    let language: keyof typeof translations = 'zh';
    try {
        if (localStorage.getItem('app-language') === 'en') language = 'en';
    } catch {
        // 无法读取时使用默认语言
    }
    toast.warning(translations[language].errors.AI_DAILY_LIMIT_EXCEEDED);
}

async function request<T>(url: string, options: RequestOptions = {}): Promise<T> {
    const { params, headers, timeout = 60000, ...rest } = options;

    let finalUrl = url;
    if (params) {
        const searchParams = new URLSearchParams(params);
        finalUrl += `?${searchParams.toString()}`;
    }

    const defaultHeaders: HeadersInit = {
        'Content-Type': 'application/json',
    };

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const res = await fetch(finalUrl, {
            headers: {
                ...defaultHeaders,
                ...headers,
            },
            signal: controller.signal,
            ...rest,
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
            let errorData;
            try {
                errorData = await res.json();
            } catch {
                errorData = await res.text();
            }
            if (res.status === 429) notifyAiDailyLimit(errorData);
            throw new ApiError(res.status, res.statusText, errorData);
        }

        // Handle empty responses (e.g. 204 No Content)
        if (res.status === 204) {
            return {} as T;
        }

        try {
            return await res.json();
        } catch {
            // If JSON parse fails but response was OK, return text or empty object?
            // For now, assume JSON APIs.
            return {} as T;
        }
    } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
            throw new ApiError(408, 'Request Timeout', {
                message: 'AI_TIMEOUT_ERROR'
            });
        }
        throw error;
    }
}

export const apiClient = {
    get: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'GET' }),
    post: <TResponse, TBody = unknown>(url: string, body: TBody, options?: RequestOptions) => request<TResponse>(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
    put: <TResponse, TBody = unknown>(url: string, body: TBody, options?: RequestOptions) => request<TResponse>(url, { ...options, method: 'PUT', body: JSON.stringify(body) }),
    patch: <TResponse, TBody = unknown>(url: string, body: TBody, options?: RequestOptions) => request<TResponse>(url, { ...options, method: 'PATCH', body: JSON.stringify(body) }),
    delete: <T>(url: string, options?: RequestOptions) => request<T>(url, { ...options, method: 'DELETE' }),
};
