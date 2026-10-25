"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { AuthShell } from "@/components/auth-shell";
import { PasswordStep } from "@/components/setup/password-step";
import { Card, CardContent } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/lib/page-title";

export default function SetupPage() {
    const { t } = useLanguage();
    usePageTitle(t.setup.pageTitle);
    const router = useRouter();
    const { data: session, status } = useSession();
    const mustChangePassword = session?.user?.mustChangePassword === true;

    useEffect(() => {
        if (status === "authenticated" && !mustChangePassword) {
            router.replace("/");
        }
    }, [status, mustChangePassword, router]);

    return (
        <AuthShell>
            <Card>
                <CardContent className="space-y-4 pt-6">
                    {mustChangePassword && <PasswordStep onDone={() => router.replace("/")} />}
                    <button
                        type="button"
                        onClick={() => signOut({ callbackUrl: "/login" })}
                        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                    >
                        {t.setup.logout}
                    </button>
                </CardContent>
            </Card>
        </AuthShell>
    );
}
