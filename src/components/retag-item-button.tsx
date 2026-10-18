"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api-client";
import { frontendLogger } from "@/lib/frontend-logger";

interface RetagItemButtonProps {
    errorItemId: string;
    /** 重新生成成功后回调，用于刷新题目 */
    onDone: () => void;
}

/** 单题用 AI 重新生成知识点 */
export function RetagItemButton({ errorItemId, onDone }: RetagItemButtonProps) {
    const { t } = useLanguage();
    const [running, setRunning] = useState(false);

    const handleClick = async () => {
        setRunning(true);
        try {
            await apiClient.post(`/api/error-items/${errorItemId}/retag`, {});
            onDone();
        } catch (error) {
            const code = (error as { data?: { message?: string } })?.data?.message || "";
            const mapped = (t.errors as Record<string, unknown>)[code];
            frontendLogger.error('[RetagItem]', 'Failed to regenerate tags', { code });
            alert(code === "NO_TAGS_SELECTED" ? t.retag.noTags : typeof mapped === "string" ? mapped : t.retag.itemFailed);
        } finally {
            setRunning(false);
        }
    };

    return (
        <Button variant="ghost" size="sm" onClick={handleClick} disabled={running}>
            {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {running ? t.retag.itemRunning : t.retag.itemButton}
        </Button>
    );
}
