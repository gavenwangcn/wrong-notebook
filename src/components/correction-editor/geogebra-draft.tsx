"use client";

import { useState } from "react";
import { Box, Loader2 } from "lucide-react";
import { GeogebraDemo } from "@/components/geogebra-demo";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "@/lib/feedback";
import { frontendLogger } from "@/lib/frontend-logger";
import type { CorrectionDraft, UpdateDraft } from "./types";

interface GeogebraDraftProps {
    data: CorrectionDraft;
    onChange: UpdateDraft;
}

/** 校对页的 GeoGebra 演示：题目和答案都填写后才可生成，生成结果随题目一起保存 */
export function GeogebraDraft({ data, onChange }: GeogebraDraftProps) {
    const { t } = useLanguage();
    const [analyzing, setAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = async () => {
        if (!data.questionText.trim()) {
            toast.warning(t.editor.enterQuestionFirst || '请先输入题目文本');
            return;
        }
        if (!data.answerText.trim()) {
            toast.warning('请先生成或输入答案');
            return;
        }

        setAnalyzing(true);
        setError(null);
        try {
            const response = await fetch("/api/geogebra-analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ questionText: data.questionText, answerText: data.answerText, analysis: data.analysis }),
            });
            if (!response.ok) {
                throw new Error("Analysis failed");
            }
            const result = await response.json();
            if (result.suitable && result.commands?.length > 0) {
                onChange({ geogebraCommands: JSON.stringify(result.commands) });
            } else {
                setError(result.description || "该题目不适合用 GeoGebra 演示");
            }
        } catch (err) {
            frontendLogger.error('[CorrectionEditor]', 'GeoGebra analysis failed', { error: err });
            setError("分析失败，请稍后重试");
        } finally {
            setAnalyzing(false);
        }
    };

    if (data.geogebraCommands) {
        return <GeogebraDemo commands={data.geogebraCommands} height={350} onRegenerate={handleAnalyze} onDelete={async () => onChange({ geogebraCommands: undefined })} />;
    }
    if (!data.questionText.trim() || !data.answerText.trim()) return null;

    return (
        <div className="rounded-lg border border-dashed p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Box className="h-4 w-4" />
                    <span>GeoGebra 动态演示</span>
                </div>
                <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={analyzing}>
                    {analyzing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI 分析中...</> : <><Box className="mr-2 h-4 w-4" />生成演示</>}
                </Button>
            </div>
            {error && <p className="text-xs text-muted-foreground mt-2">{error}</p>}
            <p className="text-xs text-muted-foreground mt-2">AI 将判断本题是否可以用 GeoGebra 进行动态演示</p>
        </div>
    );
}
