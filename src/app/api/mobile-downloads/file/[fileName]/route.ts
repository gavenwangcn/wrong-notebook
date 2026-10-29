import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { getMobileApkDirectory, resolveMobileApkFileName } from '@/lib/mobile-apk-downloads';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ fileName: string }> };

export async function GET(_request: Request, context: RouteContext) {
    const { fileName: raw } = await context.params;
    const fileName = resolveMobileApkFileName(decodeURIComponent(raw));
    if (!fileName) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const fullPath = path.join(getMobileApkDirectory(), fileName);
    const buffer = fs.readFileSync(fullPath);
    return new NextResponse(buffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.android.package-archive',
            'Content-Disposition': `attachment; filename="${fileName}"`,
            'Content-Length': String(buffer.length),
            'Cache-Control': 'no-cache',
        },
    });
}
