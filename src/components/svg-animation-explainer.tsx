"use client";

import { useState } from "react";
import { Clapperboard, Loader2, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api-client";
import { frontendLogger } from "@/lib/frontend-logger";
import { figureSvgToDataUri } from "@/lib/figure-svg";

/** 动画 SVG 较长，AI 通常需要几分钟才能写完，前端等待上限与服务端 AI 请求超时一致 */
const GENERATE_TIMEOUT_MS = 10 * 60 * 1000;

interface SvgAnimationExplainerProps {
    errorItemId: string;
    svgAnimation: string | null | undefined;
    /** 生成或删除后回调新的动画（删除后为 null） */
    onChange: (svgAnimation: string | null) => void;
}

/**
 * 题目的 SVG 动画讲解：未生成时显示生成入口；已生成时可重播、重新生成和删除（删除需二次确认）。
 * 用 <img> 加载 data URI，SVG 中的 SMIL/CSS 动画照常播放，脚本不会执行。
 */
export function SvgAnimationExplainer({ errorItemId, svgAnimation, onChange }: SvgAnimationExplainerProps) {
    const { t } = useLanguage();
    const [generating, setGenerating] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // 每次重播改变 <img> 的地址（末尾追加注释），浏览器重新加载 SVG，动画从头播放；
    // 地址不变时浏览器可能复用已加载的图片，动画不会重新开始
    const [playKey, setPlayKey] = useState(0);

    const handleGenerate = async () => {
        setGenerating(true);
        setError(null);
        try {
            const result = await apiClient.post<{ svgAnimation: string }>(`/api/error-items/${errorItemId}/svg-animation`, {}, { timeout: GENERATE_TIMEOUT_MS });
            onChange(result.svgAnimation);
            setPlayKey((key) => key + 1);
        } catch (err) {
            const code = (err as { data?: { message?: string } })?.data?.message || "";
            const mapped = (t.errors as Record<string, unknown>)[code];
            frontendLogger.error('[SvgAnimation]', 'Failed to generate SVG animation', { code });
            setError(
                code === "NO_QUESTION_TEXT" ? t.svgAnimation.noQuestionText
                    : code === "NO_VALID_ANIMATION" ? t.svgAnimation.invalid
                        : typeof mapped === "string" ? mapped : t.svgAnimation.failed
            );
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(t.svgAnimation.confirmDelete)) return;
        setDeleting(true);
        try {
            await apiClient.delete(`/api/error-items/${errorItemId}/svg-animation`);
            onChange(null);
            setError(null);
        } catch (err) {
            frontendLogger.error('[SvgAnimation]', 'Failed to delete SVG animation', { error: err instanceof Error ? err.message : String(err) });
            alert(t.svgAnimation.deleteFailed);
        } finally {
            setDeleting(false);
        }
    };

    if (!svgAnimation) {
        return (
            <div className="rounded-lg border border-dashed p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clapperboard className="h-4 w-4" />
                        <span>{t.svgAnimation.title}</span>
                    </div>
                    <Button variant="outline" size="sm" onClick={handleGenerate} disabled={generating}>
                        {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Clapperboard className="mr-2 h-4 w-4" />}
                        {generating ? t.svgAnimation.generating : t.svgAnimation.generate}
                    </Button>
                </div>
                {error && <p className="text-xs text-destructive mt-2">{error}</p>}
                <p className="text-xs text-muted-foreground mt-2">{t.svgAnimation.hint}</p>
            </div>
        );
    }

    const busy = generating || deleting;
    return (
        <div className="rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b bg-muted/30">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-muted-foreground">{t.svgAnimation.title}</span>
                    {busy && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => setPlayKey((key) => key + 1)} disabled={busy}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        <span>{t.svgAnimation.replay}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={handleGenerate} disabled={busy}>
                        {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        <span>{generating ? t.svgAnimation.generating : t.svgAnimation.regenerate}</span>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive" onClick={handleDelete} disabled={busy}>
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>{t.svgAnimation.delete}</span>
                    </Button>
                </div>
            </div>
            {error && <p className="px-3 pt-2 text-xs text-destructive">{error}</p>}
            <div className="p-2 sm:p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data URI 的 SVG 动画，无需图片优化 */}
                <img
                    src={figureSvgToDataUri(`${svgAnimation}<!--${playKey}-->`)}
                    alt={t.svgAnimation.alt}
                    className="mx-auto block h-auto w-full max-w-3xl rounded border bg-white"
                />
            </div>
        </div>
    );
}
