"use client";

import { MarkdownEditor } from "@/components/markdown-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import type { MistakeStatus } from "@/lib/mistake-status";
import type { CorrectionDraft, UpdateDraft } from "./types";

interface MistakeFieldsProps {
    data: CorrectionDraft;
    onChange: UpdateDraft;
}

/** 作答状态、错误解答原文与错因分析；填写错误解答时作答状态自动改为做错了 */
export function MistakeFields({ data, onChange }: MistakeFieldsProps) {
    const { t } = useLanguage();

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t.editor.mistakeAnalysisTitle || "错因分析"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label>{t.editor.mistakeStatus || "作答状态"}</Label>
                    <Select value={data.mistakeStatus || "unknown"} onValueChange={(val) => onChange({ mistakeStatus: val as MistakeStatus })}>
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="not_attempted">{t.editor.mistakeStatuses?.notAttempted || "不会做"}</SelectItem>
                            <SelectItem value="wrong_attempt">{t.editor.mistakeStatuses?.wrongAttempt || "做错了"}</SelectItem>
                            <SelectItem value="unknown">{t.editor.mistakeStatuses?.unknown || "未判断"}</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>{t.editor.wrongAnswerText || "错误解答原文"}</Label>
                    <MarkdownEditor
                        value={data.wrongAnswerText || ""}
                        onChange={(value) => onChange({ wrongAnswerText: value, mistakeStatus: value.trim() ? "wrong_attempt" : data.mistakeStatus })}
                        className="min-h-[100px] font-mono text-sm"
                        placeholder={t.editor.wrongAnswerPlaceholder || "如果图片里没有错误解答，可留空"}
                    />
                </div>
                <div className="space-y-2">
                    <Label>{t.editor.mistakeAnalysis || "错因分析"}</Label>
                    <MarkdownEditor
                        value={data.mistakeAnalysis || ""}
                        onChange={(value) => onChange({ mistakeAnalysis: value })}
                        className="min-h-[140px] font-mono text-sm"
                        placeholder={t.editor.mistakeAnalysisPlaceholder || "分析错误可能发生在哪一步、为什么错、导致什么后果"}
                    />
                </div>
            </CardContent>
        </Card>
    );
}
