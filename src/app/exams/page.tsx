"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTimeZone } from "@/contexts/TimeZoneContext";
import { formatDateTime } from "@/lib/date-time";
import { FileText, House, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BackButton } from "@/components/ui/back-button";
import { ExamCreateForm } from "@/components/exam/exam-create-form";
import { ExamStatusBadge } from "@/components/exam/exam-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/lib/page-title";
import { apiClient } from "@/lib/api-client";
import type { ExamPaperSummary } from "@/types/api";

export default function ExamsPage() {
    const { timeZone } = useTimeZone();
    const { t } = useLanguage();
    usePageTitle(t.exam.title);
    const [papers, setPapers] = useState<ExamPaperSummary[] | null>(null);
    const [showForm, setShowForm] = useState(false);

    useEffect(() => {
        apiClient.get<ExamPaperSummary[]>("/api/exams")
            .then((data) => {
                setPapers(data);
                if (data.length === 0) setShowForm(true);
            })
            .catch(() => setPapers([]));
    }, []);

    const difficultyLabels = t.practice.difficulty as Record<string, string>;

    return (
        <main className="min-h-screen p-4 md:p-8 bg-background">
            <div className="max-w-5xl mx-auto space-y-6">
                <div className="flex items-start gap-4">
                    <BackButton fallbackUrl="/" />
                    <div className="flex-1 space-y-1">
                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t.exam.title}</h1>
                        <p className="text-muted-foreground text-sm sm:text-base">{t.exam.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {!showForm && (
                            <Button size="sm" onClick={() => setShowForm(true)} aria-label={t.exam.create}>
                                <Plus className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">{t.exam.create}</span>
                            </Button>
                        )}
                        <Link href="/">
                            <Button variant="ghost" size="icon">
                                <House className="h-5 w-5" />
                            </Button>
                        </Link>
                    </div>
                </div>

                {showForm && <ExamCreateForm />}

                <section className="space-y-3">
                    <h2 className="text-lg font-semibold">{t.exam.list}</h2>
                    {papers === null ? (
                        <p className="text-sm text-muted-foreground">{t.common.loading}</p>
                    ) : papers.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t.exam.empty}</p>
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2">
                            {papers.map((paper) => (
                                <Link key={paper.id} href={`/exams/${paper.id}`}>
                                    <Card className="h-full hover:border-primary/50 transition-colors">
                                        <CardContent className="space-y-2 pt-4">
                                            <div className="flex items-start justify-between gap-2">
                                                <span className="flex items-center gap-2 font-medium">
                                                    <FileText className="h-4 w-4 shrink-0 text-primary" />
                                                    {paper.title}
                                                </span>
                                                <ExamStatusBadge status={paper.status} />
                                            </div>
                                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <span>{formatDateTime(paper.createdAt, "yyyy-MM-dd HH:mm", timeZone)}</span>
                                                <span>{t.exam.questionCount.replace("{count}", String(paper.questionCount))}</span>
                                                <span>{t.exam.scopes[paper.scope]}</span>
                                                <span>{difficultyLabels[paper.difficulty] || paper.difficulty}</span>
                                                <span>{paper.recordedCount > 0 ? t.exam.recorded : t.exam.notRecorded}</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
