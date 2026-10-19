import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ExamDetailPage from '@/app/exams/[id]/page';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { TimeZoneProvider, useTimeZone } from '@/contexts/TimeZoneContext';
import { apiClient } from '@/lib/api-client';
import { translations } from '@/lib/translations';

vi.mock('next/navigation', () => ({ useParams: () => ({ id: 'paper-1' }), useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({ default: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a> }));
vi.mock('@/components/ui/back-button', () => ({ BackButton: () => null }));
vi.mock('@/components/exam/exam-question-card', () => ({
    ExamQuestionCard: ({ onResultChange }: { onResultChange?: (result: 'correct') => void }) => <button onClick={() => onResultChange?.('correct')}>选择做对</button>,
}));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), post: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;
const recordedAt = '2026-10-19T03:27:00Z';

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    // 只冻结日期，保证“今天”与记录日期一致
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(recordedAt));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(apiClient.get).mockResolvedValue({
        id: 'paper-1', title: '数学练习', createdAt: recordedAt, status: 'ready', requestedCount: 1,
        questions: [{ id: 'q1', status: 'ready', errorItemId: 'e1', attempts: [{ id: 'r1', result: 'correct', createdAt: recordedAt }] }],
    });
    vi.mocked(apiClient.post).mockResolvedValue({});
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
    vi.useRealTimers();
});

function ChangeTimeZone() {
    const { setTimeZone } = useTimeZone();
    return <button onClick={() => setTimeZone('UTC')}>切换时区</button>;
}
async function renderPage(timeZone: string) {
    await act(async () => root.render(<LanguageProvider><TimeZoneProvider initialTimeZone={timeZone}><ExamDetailPage /><ChangeTimeZone /></TimeZoneProvider></LanguageProvider>));
}
const click = (text: string) => act(async () => Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes(text))!.click());

describe('试卷页面使用应用时区', () => {
    it.each([
        ['Asia/Shanghai', '2026-10-19 11:27', '2026-10-19', '2026-10-19T04:00:00.000Z'],
        ['America/New_York', '2026-10-18 23:27', '2026-10-18', '2026-10-18T16:00:00.000Z'],
    ])('%s 下显示时间、日期默认值和保存结果保持一致', async (zone, displayed, date, saved) => {
        await renderPage(zone);
        expect(container.textContent).toContain(displayed);
        await click(translations.zh.exam.recordResults);
        expect(container.querySelector<HTMLInputElement>('#exam-taken-at')?.value).toBe(date);
        await click('选择做对');
        await click(translations.zh.exam.saveResults);
        expect(apiClient.post).toHaveBeenCalledWith('/api/exams/paper-1/results', {
            takenAt: saved,
            results: [{ questionId: 'q1', result: 'correct' }],
        });
    });

    it('每次录入从空白开始，未选择任何结果时不能保存', async () => {
        await renderPage('Asia/Shanghai');
        await click(translations.zh.exam.recordResults);
        const save = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes(translations.zh.exam.saveResults));
        expect(save?.disabled).toBe(true);
        expect(container.textContent).toContain(translations.zh.exam.noResultSelected);
    });

    it('更新设置中的时区后，当前页面立即使用新时区显示', async () => {
        await renderPage('Asia/Shanghai');
        expect(container.textContent).toContain('2026-10-19 11:27');
        await click('切换时区');
        expect(container.textContent).toContain('2026-10-19 03:27');
        expect(container.textContent).not.toContain('2026-10-19 11:27');
    });
});
