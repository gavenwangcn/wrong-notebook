"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { PageLoading } from "@/components/ui/page-loading";
import { Plus, Pencil } from "lucide-react";
import Link from "next/link";
import { ErrorList } from "@/components/error-list";
import { RenameNotebookDialog } from "@/components/rename-notebook-dialog";
import { RetagNotebookButton } from "@/components/retag-notebook-button";
import { NotebookScopeLabel } from "@/components/notebook-scope-label";

import { Notebook } from "@/types/api";
import { apiClient } from "@/lib/api-client";

import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/lib/page-title";
import { toast } from "@/lib/feedback";

export default function NotebookDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { t } = useLanguage();
    const [notebook, setNotebook] = useState<Notebook | null>(null);
    usePageTitle(t.notebooks.title, notebook?.name);
    const [loading, setLoading] = useState(true);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    // 批量重新生成知识点后递增，用于刷新题目列表
    const [listVersion, setListVersion] = useState(0);

    useEffect(() => {
        if (params.id) {
            fetchNotebook(params.id as string);
        }
    }, [params.id]);

    const fetchNotebook = async (id: string) => {
        try {
            const data = await apiClient.get<Notebook>(`/api/notebooks/${id}`);
            setNotebook(data);
        } catch (error) {
            console.error("Failed to fetch notebook:", error);
            toast.error(t.notebooks?.notFound || "Notebook not found");
            router.push("/notebooks");
        } finally {
            setLoading(false);
        }
    };

    const handleRename = async (name: string) => {
        if (!notebook) return;
        const updated = await apiClient.put<Notebook>(`/api/notebooks/${notebook.id}`, { name });
        setNotebook(updated);
    };

    if (loading) {
        return <PageLoading label={t.common.loading} />;
    }

    if (!notebook) return null;

    return (
        <main className="mx-auto min-h-screen max-w-6xl px-4 py-6 md:px-8 md:py-8">
            <div className="space-y-6">
                <PageHeader
                    backHref="/notebooks"
                    title={notebook.name}
                    titleAddon={
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground"
                            onClick={() => setRenameDialogOpen(true)}
                            title={t.notebooks?.rename || "Rename"}
                        >
                            <Pencil className="h-4 w-4" />
                        </Button>
                    }
                    description={
                        <>
                            <NotebookScopeLabel notebook={notebook} />
                            {" · "}
                            {(t.notebooks?.totalErrors || "Total {count} errors").replace("{count}", (notebook._count?.errorItems || 0).toString())}
                        </>
                    }
                    actions={
                        <>
                            <RetagNotebookButton notebookId={notebook.id} onFinished={() => setListVersion(v => v + 1)} />
                            <Link href={`/notebooks/${notebook.id}/add`}>
                                <Button aria-label={t.notebooks?.addError || "Add Error"}>
                                    <Plus className="h-4 w-4" />
                                    <span className="hidden sm:inline">{t.notebooks?.addError || "Add Error"}</span>
                                </Button>
                            </Link>
                        </>
                    }
                />

                <ErrorList key={listVersion} subjectId={notebook.id} subjectName={notebook.name} />

                <RenameNotebookDialog
                    open={renameDialogOpen}
                    onOpenChange={setRenameDialogOpen}
                    currentName={notebook.name}
                    onRename={handleRename}
                />
            </div>
        </main>
    );
}
