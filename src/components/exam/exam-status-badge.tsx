"use client";

import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/contexts/LanguageContext";
import type { ExamStatus } from "@/types/api";

const STATUS_CLASS: Record<ExamStatus, string> = {
    generating: "bg-blue-100 text-blue-700 border-blue-200",
    ready: "bg-green-100 text-green-700 border-green-200",
    partial: "bg-amber-100 text-amber-700 border-amber-200",
    failed: "bg-red-100 text-red-700 border-red-200",
};

export function ExamStatusBadge({ status }: { status: ExamStatus }) {
    const { t } = useLanguage();
    return <Badge variant="outline" className={STATUS_CLASS[status]}>{t.exam.status[status]}</Badge>;
}
