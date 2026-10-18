"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { RESULT_BADGE_CLASS } from "@/components/mastery-panel";
import { PracticeResultPicker } from "@/components/practice-result-picker";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ExamQuestionDetail, PracticeResult } from "@/types/api";

interface ExamQuestionCardProps {
    question: ExamQuestionDetail;
    /** 录入模式下的待保存结果；undefined 表示非录入模式 */
    editingResult?: PracticeResult | null;
    onResultChange?: (result: PracticeResult) => void;
}

export function ExamQuestionCard({ question, editingResult, onResultChange }: ExamQuestionCardProps) {
    const { t } = useLanguage();
    const [showAnswer, setShowAnswer] = useState(false);
    const isEditing = editingResult !== undefined;
    // AI 错误码（如 AI_AUTH_ERROR: ...）映射为界面提示
    const errorText = (() => {
        if (!question.error) return "";
        if (question.error === "SOURCE_DELETED") return t.exam.sourceDeleted;
        const code = question.error.split(":")[0].trim();
        const mapped = (t.errors as Record<string, unknown>)[code];
        return typeof mapped === "string" ? mapped : question.error;
    })();

    return (
        <Card>
            <CardContent className="space-y-3 pt-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-semibold">{question.order}.</span>
                    {question.errorItemId ? (
                        <Link href={`/error-items/${question.errorItemId}`} className="font-mono text-xs text-primary hover:underline">
                            {t.exam.source} {question.sourceShortId}
                        </Link>
                    ) : (
                        <span className="font-mono text-xs text-muted-foreground">
                            {question.sourceShortId} · {t.exam.sourceDeleted}
                        </span>
                    )}
                    {question.notebookName && <Badge variant="secondary">{question.notebookName}</Badge>}
                    {!isEditing && question.result && (
                        <Badge variant="outline" className={`ml-auto ${RESULT_BADGE_CLASS[question.result] || ""}`}>
                            {t.mastery.results[question.result]}
                        </Badge>
                    )}
                </div>

                {question.status === "pending" && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.exam.questionPending}
                    </p>
                )}
                {question.status === "failed" && (
                    <p className="text-sm text-destructive">{t.exam.questionFailed}{errorText ? `：${errorText}` : ""}</p>
                )}
                {question.status === "ready" && question.questionText && (
                    <>
                        <MarkdownRenderer content={question.questionText} />
                        <button
                            type="button"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => setShowAnswer(!showAnswer)}
                        >
                            {showAnswer ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            {t.exam.showAnswer}
                        </button>
                        {showAnswer && (
                            <div className="space-y-2 rounded-md bg-muted/40 p-3">
                                {question.answerText && <MarkdownRenderer content={question.answerText} className="font-semibold" />}
                                {question.analysis && <MarkdownRenderer content={question.analysis} />}
                            </div>
                        )}
                    </>
                )}

                {isEditing && question.status === "ready" && question.errorItemId && onResultChange && (
                    <PracticeResultPicker value={editingResult} onChange={onResultChange} size="sm" />
                )}
            </CardContent>
        </Card>
    );
}
