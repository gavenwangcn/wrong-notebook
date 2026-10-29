import { getAndroidAppBridge, type AndroidAppBridge } from '@/lib/android-app';
import { getIOSAppBridge, type IOSAppBridge } from '@/lib/ios-app';

/** 安卓 / iOS 客户端壳向网页暴露的同一套接口 */
export type NativeAppBridge = AndroidAppBridge | IOSAppBridge;

export function getNativeAppBridge(): NativeAppBridge | null {
    return getAndroidAppBridge() ?? getIOSAppBridge();
}
