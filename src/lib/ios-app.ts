/**
 * iOS App（packaging/ios）向网页注入的接口 window.WrongNotebookIOS。
 * 在普通浏览器中不存在，调用前用 getIOSAppBridge() 判断。
 */
export interface IOSAppBridge {
    changeServer(): void;
    getServerUrl(): string;
    getDeviceType(): string;
    isStandalone?(): boolean;
}

type WindowWithIOSBridge = Window & { WrongNotebookIOS?: IOSAppBridge };

export function getIOSAppBridge(): IOSAppBridge | null {
    if (typeof window === 'undefined') return null;
    return (window as WindowWithIOSBridge).WrongNotebookIOS ?? null;
}
