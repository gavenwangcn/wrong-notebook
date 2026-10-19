"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { BookOpen, ListChecks, Target } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

interface HomeHeroProps {
    notebookCount: number;
    itemCount: number;
    /** 从错题本页进入时的目标错题本名称 */
    targetNotebook?: string;
}

const subscribeNothing = () => () => {};

/** 首页顶部欢迎区：问候语 + 错题本/错题数量 */
export function HomeHero({ notebookCount, itemCount, targetNotebook }: HomeHeroProps) {
    const { t, language } = useLanguage();
    const { data: session } = useSession();
    // 问候语依赖本地时间，服务端渲染时返回 null，避免两端渲染不一致
    const hour = useSyncExternalStore(subscribeNothing, () => new Date().getHours(), () => null);

    const greeting = hour === null
        ? t.common.welcome.replace(/[，,\s]+$/, "")
        : hour < 12 ? t.home.greetingMorning
            : hour < 18 ? t.home.greetingAfternoon
                : t.home.greetingEvening;
    const name = session?.user?.name || session?.user?.email || "";

    return (
        <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-500 to-violet-500 p-5 text-white shadow-lg shadow-indigo-500/20 md:p-7">
            <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
            <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-fuchsia-300/20 blur-2xl" />

            <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                <div className="space-y-1.5">
                    <h1 className="text-xl font-bold tracking-tight md:text-2xl">
                        {greeting}{name && `${language === "zh" ? "，" : ", "}${name}`}
                    </h1>
                    <p className="max-w-md text-sm text-white/80">{t.home.heroSubtitle}</p>
                    {targetNotebook && (
                        <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-medium">
                            <Target className="h-3.5 w-3.5" />
                            {t.home.targetNotebook.replace("{name}", targetNotebook)}
                        </p>
                    )}
                </div>

                <Link href="/notebooks" className="grid grid-cols-2 gap-3 md:w-72">
                    <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-white/20">
                        <div className="flex items-center gap-1.5 text-xs text-white/75">
                            <BookOpen className="h-3.5 w-3.5" />
                            {t.home.notebookCount}
                        </div>
                        <div className="mt-1 text-2xl font-bold tabular-nums">{notebookCount}</div>
                    </div>
                    <div className="rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm transition-colors hover:bg-white/20">
                        <div className="flex items-center gap-1.5 text-xs text-white/75">
                            <ListChecks className="h-3.5 w-3.5" />
                            {t.home.itemCount}
                        </div>
                        <div className="mt-1 text-2xl font-bold tabular-nums">{itemCount}</div>
                    </div>
                </Link>
            </div>
        </section>
    );
}
