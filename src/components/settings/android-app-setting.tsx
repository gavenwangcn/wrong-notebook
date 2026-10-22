"use client";

import { useSyncExternalStore } from "react";
import { Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getAndroidAppBridge } from "@/lib/android-app";
import type { AndroidAppBridge } from "@/lib/android-app";

const subscribeNothing = () => () => undefined;

/** 仅在安卓客户端内显示：当前服务器地址与「更换服务器」按钮 */
export function AndroidAppSetting() {
    const { t } = useLanguage();
    // 接口由客户端注入，服务端渲染时视为不存在，避免水合不一致
    const bridge = useSyncExternalStore<AndroidAppBridge | null>(subscribeNothing, getAndroidAppBridge, () => null);

    if (!bridge) return null;

    return (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <span className="break-all">{t.settings?.about?.androidServer || "Server"}: {bridge.getServerUrl()}</span>
            <Button variant="outline" className="gap-2" onClick={() => bridge.changeServer()}>
                <Server className="h-4 w-4" />
                {t.settings?.about?.changeServer || "Change server"}
            </Button>
        </div>
    );
}
