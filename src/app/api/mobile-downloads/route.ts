import { NextResponse } from 'next/server';
import { listMobileApkDownloads } from '@/lib/mobile-apk-downloads';

export const dynamic = 'force-dynamic';

export async function GET() {
    const items = listMobileApkDownloads();
    return NextResponse.json({ items });
}
