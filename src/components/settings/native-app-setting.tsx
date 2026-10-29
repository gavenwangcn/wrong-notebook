"use client";

import { Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { getNativeAppBridge } from "@/lib/native-app-bridge";
import { useSyncExternalStore } from "react";

const subscribeNothing = () => () => {};

/** 关于页：在安卓 / iOS 客户端内显示服务器信息与更换入口 */
export function NativeAppSetting() {
    const { t } = useLanguage();
    const bridge = useSyncExternalStore(subscribeNothing, getNativeAppBridge, () => null);

    if (!bridge) return null;

    if (bridge.isStandalone?.()) {
        return (
            <p className="text-sm text-muted-foreground max-w-md">
                {t.settings?.about?.androidStandalone || "Running on this device. Data is stored only on this device."}
            </p>
        );
    }

    return (
        <div className="flex flex-col items-center gap-3 text-sm">
            <span className="break-all">{t.settings?.about?.androidServer || "Server"}: {bridge.getServerUrl()}</span>
            <Button variant="outline" className="gap-2" onClick={() => bridge.changeServer()}>
                <Server className="h-4 w-4" />
                {t.settings?.about?.changeServer || "Change server"}
            </Button>
        </div>
    );
}
