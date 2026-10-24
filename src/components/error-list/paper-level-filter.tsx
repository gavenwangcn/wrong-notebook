"use client";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import type { PaperLevelFilter as PaperLevel } from "@/lib/error-list-filters";

interface PaperLevelFilterProps {
    value: PaperLevel;
    onChange: (value: PaperLevel) => void;
}

/** 按卷别筛选的标签按钮 */
export function PaperLevelFilter({ value, onChange }: PaperLevelFilterProps) {
    const { t } = useLanguage();
    const options = [
        { value: "all", label: t.filter.all || "All" },
        { value: "a", label: t.editor.paperLevels?.a || "Paper A" },
        { value: "b", label: t.editor.paperLevels?.b || "Paper B" },
        { value: "other", label: t.editor.paperLevels?.other || "Other" },
    ] as const;

    return (
        <div className="flex flex-wrap gap-2">
            {options.map((option) => (
                <Button
                    key={option.value}
                    variant={value === option.value ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </Button>
            ))}
        </div>
    );
}
