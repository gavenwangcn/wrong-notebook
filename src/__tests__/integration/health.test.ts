import { describe, it, expect, vi, afterEach } from 'vitest';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('@/lib/prisma', () => ({ prisma: { $queryRaw: query } }));

import { GET } from '@/app/api/health/route';

describe('deployment health endpoint', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.clearAllMocks();
    });

    it('checks the database and reports the running revision', async () => {
        query.mockResolvedValue([{ result: 1 }]);
        vi.stubEnv('APP_REVISION', 'a'.repeat(40));
        const response = await GET();
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({ status: 'ok', revision: 'a'.repeat(40) });
        expect(query).toHaveBeenCalledOnce();
        expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('returns 503 without exposing database errors or secrets', async () => {
        query.mockRejectedValue(new Error('sensitive connection details'));
        const response = await GET();
        expect(response.status).toBe(503);
        expect(await response.json()).toEqual({ status: 'unavailable' });
    });
});
