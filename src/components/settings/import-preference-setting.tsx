"use client";

import { useEffect, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api-client";
import { frontendLogger } from "@/lib/frontend-logger";
import type { UserProfile } from "@/types/api";

/** 「导入前人工确认」开关，切换后立即保存到用户偏好 */
export function ImportPreferenceSetting() {
    const { t } = useLanguage();
    const [checked, setChecked] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<string | null>(null);

    useEffect(() => {
        apiClient.get<UserProfile>("/api/user")
            .then((user) => setChecked(!!user.confirmBeforeImport))
            .catch(() => undefined)
            .finally(() => setLoaded(true));
    }, []);

    const handleChange = async (value: boolean) => {
        setChecked(value);
        setSaving(true);
        try {
            await apiClient.patch("/api/user", { confirmBeforeImport: value });
            setMessage(t.importFlow.preferenceSaved);
        } catch (error) {
            setChecked(!value);
            setMessage(t.importFlow.preferenceSaveFailed);
            frontendLogger.error('[Settings]', 'Failed to save import preference', {
                error: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-2 pt-4 border-t">
            <div className="flex items-center justify-between gap-4">
                <Label htmlFor="confirm-before-import">{t.importFlow.confirmBeforeImport}</Label>
                <Switch
                    id="confirm-before-import"
                    checked={checked}
                    onCheckedChange={handleChange}
                    disabled={!loaded || saving}
                />
            </div>
            <p className="text-xs text-muted-foreground">{t.importFlow.confirmBeforeImportDesc}</p>
            {message && <p className="text-xs text-muted-foreground">{message}</p>}
        </div>
    );
}
