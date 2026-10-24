"use client";

import { useState } from "react";
import { MarkdownEditor } from "@/components/markdown-editor";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { getMistakeStatusLabel, normalizeMistakeStatusForSave } from "@/lib/mistake-status";
import { EditButton, SaveCancelButtons, SectionHeader } from "./edit-controls";
import { ToggleImage } from "./toggle-image";
import type { ErrorItemDetail } from "./types";
import { useEditableField } from "./use-editable-field";

interface WrongAnswerCardProps {
    item: ErrorItemDetail;
    saveFields: (fields: Partial<ErrorItemDetail>) => Promise<void>;
    onEnlarge: (src: string) => void;
}

/** 我的答案：作答状态与错误解答原文，填写原文时作答状态自动改为做错了 */
export function WrongAnswerCard({ item, saveFields, onEnlarge }: WrongAnswerCardProps) {
    const { t, language } = useLanguage();
    const [showImage, setShowImage] = useState(false);
    const field = useEditableField({
        read: () => ({ text: item.wrongAnswerText || "", status: item.mistakeStatus || "unknown" }),
        save: ({ text, status }) => saveFields({ wrongAnswerText: text, mistakeStatus: normalizeMistakeStatusForSave(status, text) }),
        logLabel: 'wrong answer',
    });

    return (
        <Card>
            <CardHeader><SectionHeader title={<CardTitle>{t.editor?.wrongAnswerText || "我的答案"}</CardTitle>} actions={!field.editing && <EditButton onClick={field.start} />} /></CardHeader>
            <CardContent className="space-y-4">
                {field.editing ? (
                    <div className="space-y-4">
                        <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.editor?.mistakeStatus || "作答状态"}</label><Select value={field.value.status} onValueChange={(status) => field.setValue({ ...field.value, status })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_attempted">{t.editor?.mistakeStatuses?.notAttempted || "不会做"}</SelectItem><SelectItem value="wrong_attempt">{t.editor?.mistakeStatuses?.wrongAttempt || "做错了"}</SelectItem><SelectItem value="unknown">{t.editor?.mistakeStatuses?.unknown || "未判断"}</SelectItem></SelectContent></Select></div>
                        <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.editor?.wrongAnswerText || "错误解答原文"}</label><MarkdownEditor value={field.value.text} onChange={text => field.setValue({ text, status: text.trim() ? "wrong_attempt" : field.value.status })} rows={5} className="w-full font-mono text-sm" /></div>
                        <SaveCancelButtons onSave={field.submit} onCancel={field.cancel} />
                    </div>
                ) : (
                    <div className="space-y-4">
                        <Badge variant="secondary">{getMistakeStatusLabel(item.mistakeStatus, language)}</Badge>
                        {item.wrongAnswerText ? <MarkdownRenderer content={item.wrongAnswerText} /> : <p className="text-sm text-muted-foreground italic">{t.detail?.noMistakeAnalysis || "暂无错误解答"}</p>}
                        {item.wrongAnswerImageUrl && (
                            <div className="pt-3">
                                <ToggleImage src={item.wrongAnswerImageUrl} alt="我的答案图片" showLabel="查看图片" hideLabel="隐藏图片" visible={showImage} onVisibleChange={setShowImage} onEnlarge={onEnlarge} />
                            </div>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
