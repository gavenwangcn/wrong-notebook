"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { figureSvgToDataUri } from "@/lib/figure-svg";
import { cn } from "@/lib/utils";

interface QuestionFigureProps {
    svg: string | null | undefined;
    className?: string;
}

/**
 * 题目的 SVG 配图。用 <img> 加载 data URI，SVG 中即使有脚本也不会执行；
 * 固定白色背景，深色模式和打印时黑色线条都清晰可见。
 */
export function QuestionFigure({ svg, className }: QuestionFigureProps) {
    const { t } = useLanguage();
    if (!svg) return null;
    return (
        <figure className={cn("question-figure my-3", className)}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URI 的 SVG，无需图片优化 */}
            <img
                src={figureSvgToDataUri(svg)}
                alt={t.figure.alt}
                className="mx-auto block h-auto max-w-full rounded border bg-white p-2"
                style={{ maxHeight: 360 }}
            />
        </figure>
    );
}
