"use client";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { SessionProvider } from "next-auth/react";
import { TimeZoneProvider } from "@/contexts/TimeZoneContext";

export function Providers({ children, timeZone }: { children: React.ReactNode; timeZone?: string }) {
    return (
        <SessionProvider>
            <LanguageProvider>
                <TimeZoneProvider initialTimeZone={timeZone}>{children}</TimeZoneProvider>
            </LanguageProvider>
        </SessionProvider>
    );
}
