"use client";

import { LanguageProvider } from "@/contexts/LanguageContext";
import { SessionProvider } from "next-auth/react";
import { TimeZoneProvider } from "@/contexts/TimeZoneContext";
import { AppShell } from "@/components/app-shell";
import { BackgroundTasksButton } from "@/components/background-tasks-button";
import { FeedbackHost } from "@/components/ui/feedback-host";

export function Providers({ children, timeZone }: { children: React.ReactNode; timeZone?: string }) {
    return (
        <SessionProvider>
            <LanguageProvider>
                <TimeZoneProvider initialTimeZone={timeZone}>
                    <AppShell>{children}</AppShell>
                    <BackgroundTasksButton />
                    <FeedbackHost />
                </TimeZoneProvider>
            </LanguageProvider>
        </SessionProvider>
    );
}
