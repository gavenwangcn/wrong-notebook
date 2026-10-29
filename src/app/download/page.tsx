"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Smartphone, ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/lib/page-title";
import { getErrorMessage } from "@/lib/error-message";

type ApiItem = {
    fileName: string;
    downloadUrl: string;
    sizeBytes: number;
};

type MobileDownloadCopy = {
    clientPhone: string;
    clientTablet: string;
    standalonePhone: string;
    standaloneTablet: string;
    genericApk: string;
    sizeMb: string;
};

function formatSize(bytes: number, sizeMbTpl: string | undefined): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return sizeMbTpl?.includes("{size}") ? sizeMbTpl.replace("{size}", mb) : `${mb} MB`;
}

function apkDisplayName(fileName: string, md: MobileDownloadCopy): string {
    if (fileName.includes("Client-Phone")) return md.clientPhone;
    if (fileName.includes("Client-Tablet")) return md.clientTablet;
    if (fileName.includes("Tablet")) return md.standaloneTablet;
    if (fileName.includes("Phone")) return md.standalonePhone;
    return md.genericApk;
}

function apkVersionLabel(fileName: string): string {
    const m = fileName.match(/-(\d{4}\.\d{2}\.\d{2}(?:-\d+)?)\.apk$/i);
    return m ? `v${m[1]}` : "";
}

export default function MobileDownloadPage() {
    const { t } = useLanguage();
    usePageTitle(t.pageTitle.mobileDownload);
    const [items, setItems] = useState<ApiItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        fetch("/api/mobile-downloads")
            .then(async (res) => {
                if (!res.ok) throw new Error(res.statusText || String(res.status));
                return res.json() as Promise<{ items: ApiItem[] }>;
            })
            .then((data) => setItems(data.items ?? []))
            .catch((e: unknown) => setError(getErrorMessage(e)))
            .finally(() => setLoading(false));
    }, []);

    const md = t.mobileDownload;
    const labels: MobileDownloadCopy = {
        clientPhone: md?.clientPhone ?? "Client (phone)",
        clientTablet: md?.clientTablet ?? "Client (tablet)",
        standalonePhone: md?.standalonePhone ?? "Standalone (phone)",
        standaloneTablet: md?.standaloneTablet ?? "Standalone (tablet)",
        genericApk: md?.genericApk ?? "Android app",
        sizeMb: md?.sizeMb ?? "{size} MB",
    };

    return (
        <AuthShell>
            <Card className="w-full rounded-2xl border-0 shadow-xl shadow-indigo-500/5 ring-1 ring-border">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl text-center">
                        {md?.title || "Download mobile app"}
                    </CardTitle>
                    <p className="text-center text-sm text-muted-foreground">
                        {md?.subtitle || "Android APK packages"}
                    </p>
                </CardHeader>
                <CardContent className="space-y-4">
                    {loading && (
                        <p className="text-center text-sm text-muted-foreground">
                            {t.common?.loading || "Loading..."}
                        </p>
                    )}
                    {error && (
                        <div className="rounded-lg bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                            {error}
                        </div>
                    )}
                    {!loading && !error && items.length === 0 && (
                        <p className="text-center text-sm text-muted-foreground">
                            {md?.empty || "No APK files are available yet."}
                        </p>
                    )}
                    <ul className="space-y-3">
                        {items.map((item) => {
                            const version = apkVersionLabel(item.fileName);
                            return (
                                <li key={item.fileName}>
                                    <a
                                        href={item.downloadUrl}
                                        download={item.fileName}
                                        className="flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 active:bg-muted"
                                    >
                                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600">
                                            <Smartphone className="h-5 w-5" />
                                        </div>
                                        <div className="min-w-0 flex-1 text-left">
                                            <p className="font-medium leading-tight">
                                                {apkDisplayName(item.fileName, labels)}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {[version, formatSize(item.sizeBytes, labels.sizeMb)].filter(Boolean).join(" · ")}
                                            </p>
                                            <p className="truncate text-xs text-muted-foreground/80">{item.fileName}</p>
                                        </div>
                                        <Download className="h-5 w-5 shrink-0 text-primary" aria-hidden />
                                    </a>
                                </li>
                            );
                        })}
                    </ul>
                    <p className="text-center text-xs text-muted-foreground leading-relaxed">
                        {md?.installHint ||
                            "After download completes, open the notification or Files app and tap the APK to install. You may need to allow installs from your browser."}
                    </p>
                    <div className="text-center">
                        <Button variant="link" asChild className="gap-1 text-muted-foreground">
                            <Link href="/login">
                                <ArrowLeft className="h-4 w-4" />
                                {md?.backToLogin || "Back to login"}
                            </Link>
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </AuthShell>
    );
}
