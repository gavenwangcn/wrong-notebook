"use client";

import { Atom, BookOpen, BookText, ChevronRight, FlaskConical, Globe, Landmark, Languages, Leaf, Pencil, Scale, Sigma, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotebookScopeLabel } from "@/components/notebook-scope-label";
import { resolveNotebookScope } from "@/lib/notebook-scope";
import type { NotebookSubject } from "@/lib/notebook-scope";

interface NotebookCardProps {
    id: string;
    name: string;
    stage?: string | null;
    subjectKey?: string | null;
    errorCount: number;
    onClick: () => void;
    onRename?: () => void;
    onDelete?: (id: string) => void;
    itemLabel?: string;
}

/** 各学科的图标与配色，便于在列表中一眼区分 */
const SUBJECT_STYLE: Record<NotebookSubject, { icon: LucideIcon; className: string }> = {
    math: { icon: Sigma, className: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300" },
    english: { icon: Languages, className: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300" },
    chinese: { icon: BookText, className: "bg-rose-100 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300" },
    physics: { icon: Atom, className: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" },
    chemistry: { icon: FlaskConical, className: "bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300" },
    biology: { icon: Leaf, className: "bg-lime-100 text-lime-700 dark:bg-lime-500/15 dark:text-lime-300" },
    history: { icon: Landmark, className: "bg-orange-100 text-orange-600 dark:bg-orange-500/15 dark:text-orange-300" },
    geography: { icon: Globe, className: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-300" },
    politics: { icon: Scale, className: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-300" },
};

const DEFAULT_STYLE = { icon: BookOpen, className: "bg-accent text-accent-foreground" };

export function NotebookCard({ id, name, stage, subjectKey, errorCount, onClick, onRename, onDelete, itemLabel = "items" }: NotebookCardProps) {
    const scope = resolveNotebookScope({ name, stage, subjectKey });
    const { icon: Icon, className: iconClass } = scope.subject ? SUBJECT_STYLE[scope.subject] : DEFAULT_STYLE;

    return (
        <div
            role="link"
            tabIndex={0}
            className="group relative flex cursor-pointer items-center gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onClick}
            onKeyDown={(e) => {
                if (e.key === "Enter") onClick();
            }}
        >
            <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
                <Icon className="h-6 w-6" />
            </div>

            <div className="min-w-0 flex-1">
                <h3 className="truncate font-semibold">{name}</h3>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <span className="font-medium tabular-nums text-foreground">{errorCount}</span>
                    {itemLabel}
                    <span className="text-border">|</span>
                    <NotebookScopeLabel notebook={{ name, stage, subjectKey }} className="truncate" />
                </p>
            </div>

            {/* 触屏设备没有悬停，操作按钮常显；桌面端悬停时显示 */}
            <div className="flex shrink-0 items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
                {onRename && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onRename();
                        }}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
                {onDelete && (
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(id);
                        }}
                    >
                        <Trash2 className={`h-4 w-4 ${errorCount > 0 ? "text-muted-foreground" : "text-destructive"}`} />
                    </Button>
                )}
            </div>
            <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        </div>
    );
}
