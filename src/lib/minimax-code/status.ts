/**
 * 设置页显示的 MiniMax Code 账号状态：登录状态与剩余积分（实时查询）。
 * 不返回任何 Token。
 */
import { createLogger } from '@/lib/logger';
import { fetchCredits } from './api';
import type { MiniMaxCodeCredits } from './api';
import { withAccessToken } from './auth';
import { readMiniMaxCodeState } from './store';

const logger = createLogger('minimax-code');

export interface MiniMaxCodeStatus {
    /** none：未登录；active：已登录；expired：登录失效，需要重新登录 */
    login: 'none' | 'active' | 'expired';
    account: { name: string | null; email: string | null; userId: string | null; loggedInAt: string } | null;
    credits: MiniMaxCodeCredits | null;
    /** 正在进行的网页登录，页面刷新后可继续等待授权 */
    pendingLogin: { url: string; userCode: string | null; expiresAt: string; intervalMs: number } | null;
}

function isAuthError(error: unknown): boolean {
    return error instanceof Error && (error.name === 'MiniMaxCodeAuthError' || error.message.startsWith('AI_AUTH_ERROR'));
}

export async function getMiniMaxCodeStatus(): Promise<MiniMaxCodeStatus> {
    const state = readMiniMaxCodeState();
    const pending = state.pendingLogin && Date.parse(state.pendingLogin.expiresAt) > Date.now()
        ? { url: state.pendingLogin.url, userCode: state.pendingLogin.userCode, expiresAt: state.pendingLogin.expiresAt, intervalMs: state.pendingLogin.intervalMs }
        : null;
    const account = state.account;
    if (!account) return { login: 'none', account: null, credits: null, pendingLogin: pending };

    const summary = { name: account.name, email: account.email, userId: account.userId, loggedInAt: account.loggedInAt };
    if (account.invalid) return { login: 'expired', account: summary, credits: null, pendingLogin: pending };

    try {
        const credits = await withAccessToken(fetchCredits);
        return { login: 'active', account: summary, credits, pendingLogin: pending };
    } catch (error) {
        if (isAuthError(error)) return { login: 'expired', account: summary, credits: null, pendingLogin: pending };
        // 积分查询失败（网络等）不代表登录失效
        logger.warn({ error: error instanceof Error ? error.message : String(error) }, 'Failed to fetch MiniMax Code credits');
        return { login: 'active', account: summary, credits: null, pendingLogin: pending };
    }
}
