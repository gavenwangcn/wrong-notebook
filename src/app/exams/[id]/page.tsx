"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { ClipboardCheck, Loader2, Printer, RotateCcw, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BackButton } from "@/components/ui/back-button";
import { ExamQuestionCard } from "@/components/exam/exam-question-card";
import { ExamStatusBadge } from "@/components/exam/exam-status-badge";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api-client";
import type { ExamPaperDetail, PracticeResult } from "@/types/api";

const POLL_INTERVAL_MS = 3000;

export default function ExamDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { t, language } = useLanguage();
    const paperId = params.id as string;
    const [paper, setPaper] = useState<ExamPaperDetail | null>(null);
    const [notFound, setNotFound] = useState(false);
    // 录入模式下各题的待保存结果；null 表示未在录入
    const [draft, setDraft] = useState<Record<string, PracticeResult | null> | null>(null);
    const [takenAt, setTakenAt] = useState(format(new Date(), "yyyy-MM-dd"));
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            setPaper(await apiClient.get<ExamPaperDetail>(`/api/exams/${paperId}`));
        } catch {
            setNotFound(true);
        }
    }, [paperId]);

    useEffect(() => {
        load();
    }, [load]);

    // 生成中时轮询进度
    useEffect(() => {
        if (paper?.status !== "generating") return;
        const timer = setTimeout(load, POLL_INTERVAL_MS);
        return () => clearTimeout(timer);
    }, [paper, load]);

    if (notFound) return <div className="p-8 text-center">{t.exam.notFound}</div>;
    if (!paper) return <div className="p-8 text-center">{t.common.loading}</div>;

    const readyCount = paper.questions.filter((question) => question.status === "ready").length;
    const hasFailed = paper.questions.some((question) => question.status === "failed");
    const recordable = paper.questions.filter((question) => question.status === "ready" && question.errorItemId);

    const startRecording = () => {
        setMessage(null);
        setDraft(Object.fromEntries(paper.questions.map((question) => [question.id, question.result])));
        const recordedAt = paper.questions.find((question) => question.resultAt)?.resultAt;
        if (recordedAt) setTakenAt(format(new Date(recordedAt), "yyyy-MM-dd"));
    };

    const saveResults = async () => {
        if (!draft) return;
        setSaving(true);
        setMessage(null);
        try {
            await apiClient.put(`/api/exams/${paper.id}/results`, {
                takenAt: new Date(`${takenAt}T12:00:00`).toISOString(),
                results: recordable.map((question) => ({ questionId: question.id, result: draft[question.id] ?? null })),
            });
            setDraft(null);
            setMessage(t.exam.resultsSaved);
            await load();
        } catch {
            setMessage(t.exam.resultsSaveFailed);
        } finally {
            setSaving(false);
        }
    };

    const retryFailed = async () => {
        await apiClient.post(`/api/exams/${paper.id}/retry`, { language });
        await load();
    };

    const deletePaper = async () => {
        if (!confirm(t.exam.deleteConfirm)) return;
        await apiClient.delete(`/api/exams/${paper.id}`);
        router.push("/exams");
    };

    return (
        <main className="min-h-screen p-4 md:p-8 bg-background">
            <div className="max-w-4xl mx-auto space-y-6 pb-24">
                <div className="flex items-start gap-4">
                    <BackButton fallbackUrl="/exams" />
                    <div className="flex-1 min-w-0 space-y-2">
                        <h1 className="text-xl sm:text-2xl font-bold break-words">{paper.title}</h1>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                            <ExamStatusBadge status={paper.status} />
                            <span>{t.exam.progress.replace("{ready}", String(readyCount)).replace("{total}", String(paper.questions.length))}</span>
                            <span>{format(new Date(paper.createdAt), "yyyy-MM-dd HH:mm")}</span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Link href={`/exams/${paper.id}/print`}>
                        <Button variant="outline" size="sm" disabled={readyCount === 0}>
                            <Printer className="mr-2 h-4 w-4" />
                            {t.exam.print}
                        </Button>
                    </Link>
                    {!draft && recordable.length > 0 && (
                        <Button size="sm" onClick={startRecording}>
                            <ClipboardCheck className="mr-2 h-4 w-4" />
                            {t.exam.recordResults}
                        </Button>
                    )}
                    {hasFailed && paper.status !== "generating" && (
                        <Button variant="outline" size="sm" onClick={retryFailed}>
                            <RotateCcw className="mr-2 h-4 w-4" />
                            {t.exam.retryFailed}
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={deletePaper} className="text-red-600 hover:text-red-700 hover:bg-red-50 sm:ml-auto">
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t.exam.delete}
                    </Button>
                </div>

                {paper.questions.length < paper.requestedCount && (
                    <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                        {t.exam.fewerThanRequested.replaceAll("{actual}", String(paper.questions.length))}
                    </p>
                )}
                {message && <p className="rounded-md border p-3 text-sm">{message}</p>}

                {draft && (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border bg-muted/30 p-3">
                        <label htmlFor="exam-taken-at" className="text-sm font-medium">{t.exam.takenAt}</label>
                        <Input id="exam-taken-at" type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} className="sm:w-48" />
                    </div>
                )}

                <div className="space-y-3">
                    {paper.questions.map((question) => (
                        <ExamQuestionCard
                            key={question.id}
                            question={question}
                            editingResult={draft ? draft[question.id] ?? null : undefined}
                            onResultChange={(result) => setDraft((prev) => (prev ? { ...prev, [question.id]: result } : prev))}
                        />
                    ))}
                </div>

                {draft && (
                    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-background/95 p-3 backdrop-blur">
                        <div className="max-w-4xl mx-auto flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setDraft(null)} disabled={saving}>{t.exam.cancel}</Button>
                            <Button onClick={saveResults} disabled={saving || !takenAt}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                {t.exam.saveResults}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
