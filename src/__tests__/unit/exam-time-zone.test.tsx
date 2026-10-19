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
vi.mock('@/components/exam/exam-question-card', () => ({ ExamQuestionCard: () => null }));
vi.mock('@/lib/api-client', () => ({ apiClient: { get: vi.fn(), put: vi.fn() } }));

let root: Root;
let container: HTMLDivElement;
const recordedAt = '2026-10-19T03:27:00Z';

beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    vi.mocked(apiClient.get).mockResolvedValue({
        id: 'paper-1', title: '数学练习', createdAt: recordedAt, status: 'ready', requestedCount: 1,
        questions: [{ id: 'q1', status: 'ready', errorItemId: 'e1', result: 'correct', resultAt: recordedAt }],
    });
    vi.mocked(apiClient.put).mockResolvedValue({});
});
afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
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
    ])('%s 下显示时间、日期回填和保存结果保持一致', async (zone, displayed, date, saved) => {
        await renderPage(zone);
        expect(container.textContent).toContain(displayed);
        await click(translations.zh.exam.recordResults);
        expect(container.querySelector<HTMLInputElement>('#exam-taken-at')?.value).toBe(date);
        await click(translations.zh.exam.saveResults);
        expect(apiClient.put).toHaveBeenCalledWith('/api/exams/paper-1/results', expect.objectContaining({ takenAt: saved }));
    });

    it('更新设置中的时区后，当前页面立即使用新时区显示', async () => {
        await renderPage('Asia/Shanghai');
        expect(container.textContent).toContain('2026-10-19 11:27');
        await click('切换时区');
        expect(container.textContent).toContain('2026-10-19 03:27');
        expect(container.textContent).not.toContain('2026-10-19 11:27');
    });
});
