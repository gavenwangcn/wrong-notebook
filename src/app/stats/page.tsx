"use client";

import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/lib/page-title";
import { WrongAnswerStats } from "@/components/wrong-answer-stats";
import { PracticeStats } from "@/components/practice-stats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/ui/page-header";
import { TrendingUp, Activity } from "lucide-react";

export default function StatsPage() {
    const { t } = useLanguage();
    usePageTitle(t.stats.headerTitle);

    return (
        <main className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
            <PageHeader
                title={t.stats?.headerTitle || "Statistics Center"}
                description={t.stats?.headerDesc || "View your learning progress and data analysis"}
            />

            <Tabs defaultValue="wrong" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6 sm:w-auto sm:inline-grid">
                    <TabsTrigger value="wrong" className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {t.wrongAnswerStats?.title || "Wrong Answer Stats"}
                    </TabsTrigger>
                    <TabsTrigger value="practice" className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        {t.stats?.title || "Practice Stats"}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="wrong" className="space-y-4">
                    <WrongAnswerStats />
                </TabsContent>
                <TabsContent value="practice" className="space-y-4">
                    <PracticeStats />
                </TabsContent>
            </Tabs>
        </main>
    );
}
