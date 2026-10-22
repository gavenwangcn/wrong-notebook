"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageLoading } from "@/components/ui/page-loading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, RefreshCw, Trash2, Edit, Save, X, Box, Loader2, Eye, EyeOff, ImageIcon, FileQuestion } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/lib/page-title";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { MarkdownEditor } from "@/components/markdown-editor";
import { TagInput } from "@/components/tag-input";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiClient } from "@/lib/api-client";
import { UserProfile, Notebook } from "@/types/api";
import { inferSubjectFromName } from "@/lib/knowledge-tags";
import { getMistakeStatusLabel, normalizeMistakeStatusForSave } from "@/lib/mistake-status";
import { NotebookSelector } from "@/components/notebook-selector";
import { GeogebraDemo } from "@/components/geogebra-demo";
import { SvgAnimationExplainer } from "@/components/svg-animation-explainer";
import { ShortIdBadge } from "@/components/short-id-badge";
import { DifficultyStars } from "@/components/difficulty-stars";
import { QuestionFigure } from "@/components/question-figure";
import { RegenerateFigureButton } from "@/components/regenerate-figure-button";
import { ReplaceQuestionImageButton } from "@/components/replace-question-image-button";
import { MasteryPanel } from "@/components/mastery-panel";
import { MasteryStatusBadge } from "@/components/mastery-status-badge";
import { RetagItemButton } from "@/components/retag-item-button";
import { RegenerateAnswerButton } from "@/components/regenerate-answer-button";
import { FixLatexButton } from "@/components/fix-latex-button";
import { frontendLogger } from "@/lib/frontend-logger";
import { getDefaultPaperLevel } from "@/lib/paper-level";
import { toast, confirmDialog } from "@/lib/feedback";
import type { MasteryStatus } from "@/lib/mastery-status";

interface KnowledgeTag {
    id: string;
    name: string;
}

interface ErrorItemDetail {
    id: string;
    shortId?: string | null;
    questionText: string;
    answerText: string;
    analysis: string;
    wrongAnswerText?: string | null;
    mistakeAnalysis?: string | null;
    mistakeStatus?: string | null;
    knowledgePoints: string; // 保留兼容旧数据
    tags: KnowledgeTag[]; // 新的标签关联
    masteryLevel: number;
    originalImageUrl: string;
    referenceImageUrl?: string | null;
    wrongAnswerImageUrl?: string | null;
    userNotes: string | null;
    subjectId?: string | null;
    subject?: {
        id: string;
        name: string;
    } | null;
    gradeSemester?: string | null;
    paperLevel?: string | null;
    difficultyStars?: number | null;
    hasFigure?: boolean;
    figureSvg?: string | null;
    geogebraCommands?: string | null;
    svgAnimation?: string | null;    // 中文版动画讲解
    svgAnimationEn?: string | null;  // 英文版动画讲解
}

export default function ErrorDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { t, language } = useLanguage();
    const [item, setItem] = useState<ErrorItemDetail | null>(null);
    usePageTitle(t.detail.title, item?.subject?.name, item?.shortId);
    const [loading, setLoading] = useState(true);
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [notesInput, setNotesInput] = useState("");
    const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
    const [isEditingTags, setIsEditingTags] = useState(false);
    const [tagsInput, setTagsInput] = useState<string[]>([]);
    const [isEditingMetadata, setIsEditingMetadata] = useState(false);
    const [gradeSemesterInput, setGradeSemesterInput] = useState("");
    const [paperLevelInput, setPaperLevelInput] = useState("a");
    const [notebookInput, setNotebookInput] = useState<string | null>(null);

    const [educationStage, setEducationStage] = useState<string | undefined>(undefined);

    const [isAnalyzingGeogebra, setIsAnalyzingGeogebra] = useState(false);
    const [geogebraError, setGeogebraError] = useState<string | null>(null);
    // GeoGebra 动态演示默认关闭，用户在设置中开启后才显示
    const [geogebraEnabled, setGeogebraEnabled] = useState(false);
    // SVG 动画讲解默认开启，用户可在设置中关闭
    const [svgAnimationEnabled, setSvgAnimationEnabled] = useState(true);
    const [showQuestionImage, setShowQuestionImage] = useState(false);
    const [showReferenceImage, setShowReferenceImage] = useState(false);
    const [showOwnImage, setShowOwnImage] = useState(false);
    const [showFloatingQuestion, setShowFloatingQuestion] = useState(false);
    const questionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Fetch user info for education stage
        apiClient.get<UserProfile>("/api/user")
            .then(user => {
                if (user && user.educationStage) {
                    setEducationStage(user.educationStage);
                }
                setGeogebraEnabled(!!user?.enableGeogebra);
                setSvgAnimationEnabled(user?.enableSvgAnimation !== false);
            })
            .catch(err => console.error("Failed to fetch user info:", err));

        if (params.id) {
            fetchItem(params.id as string);
        }
    }, [params.id]);

    // 复习状态由举一反三记录和掌握概率决定，随掌握面板的数据更新
    const [masteryStatus, setMasteryStatus] = useState<MasteryStatus | null>(null);

    const fetchItem = async (id: string) => {
        try {
            const data = await apiClient.get<ErrorItemDetail>(`/api/error-items/${id}`);
            setItem(data);
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.loadFailed || 'Failed to load item');
            router.push("/notebooks");
        } finally {
            setLoading(false);
        }
    };

    const handleAnalyzeGeogebra = async () => {
        if (!item) return;
        setIsAnalyzingGeogebra(true);
        setGeogebraError(null);
        try {
            const result = await apiClient.post<{
                suitable: boolean;
                commands: string[];
                description: string;
            }>(`/api/error-items/${item.id}/geogebra`, {});

            if (result.suitable && result.commands.length > 0) {
                setItem({ ...item, geogebraCommands: JSON.stringify(result.commands) });
            } else {
                setGeogebraError(result.description || "该题目不适合用 GeoGebra 演示");
            }
        } catch (error: any) {
            console.error("GeoGebra analysis failed:", error);
            const msg = error?.data?.message || error?.message || "";
            if (msg.includes("AI_AUTH_ERROR")) {
                setGeogebraError("AI 认证失败，请检查设置");
            } else if (msg.includes("AI_CONNECTION")) {
                setGeogebraError("AI 连接失败，请检查网络");
            } else {
                setGeogebraError("分析失败，请稍后重试");
            }
        } finally {
            setIsAnalyzingGeogebra(false);
        }
    };

    const [savingDifficulty, setSavingDifficulty] = useState(false);
    const handleDifficultyChange = async (difficultyStars: number | null) => {
        if (!item) return;
        const previous = item.difficultyStars ?? null;
        setItem({ ...item, difficultyStars });
        setSavingDifficulty(true);
        try {
            const updated = await apiClient.put<Pick<ErrorItemDetail, "paperLevel">>(`/api/error-items/${item.id}`, { difficultyStars });
            setItem((current) => current && { ...current, paperLevel: updated.paperLevel });
        } catch (error) {
            setItem((current) => current && { ...current, difficultyStars: previous });
            frontendLogger.error('[ErrorDetail]', 'Failed to save difficulty', { error: error instanceof Error ? error.message : String(error) });
            toast.error(t.difficulty.saveFailed);
        } finally {
            setSavingDifficulty(false);
        }
    };

    const handleSaveGeogebraCommands = async (commands: string) => {
        if (!item) return;
        await apiClient.put(`/api/error-items/${item.id}`, { geogebraCommands: commands });
        setItem({ ...item, geogebraCommands: commands });
    };

    // 失败时抛出，由 GeogebraDemo 提示
    const handleDeleteGeogebra = async () => {
        if (!item) return;
        await apiClient.delete(`/api/error-items/${item.id}/geogebra`);
        setItem((current) => current && { ...current, geogebraCommands: null });
    };

    const handleAnswerRegenerated = useCallback((updated: { answerText: string | null; analysis: string | null }) => {
        setItem((current) => current && { ...current, answerText: updated.answerText ?? "", analysis: updated.analysis ?? "" });
    }, []);

    const handleLatexFixed = useCallback((updated: Partial<Pick<ErrorItemDetail, "questionText" | "answerText" | "analysis" | "wrongAnswerText" | "mistakeAnalysis">>) => {
        setItem((current) => current && { ...current, ...updated });
    }, []);

    // 动画按语言分别保存，生成或删除只影响对应语言的版本
    const handleSvgAnimationChange = useCallback((animationLanguage: 'zh' | 'en', svgAnimation: string | null) => {
        setItem((current) => current && { ...current, [animationLanguage === 'en' ? 'svgAnimationEn' : 'svgAnimation']: svgAnimation });
    }, []);

    const deleteItem = async () => {
        if (!item) return;

        const confirmMessage = t.common?.messages?.confirmDelete || 'Are you sure you want to delete this error item?';
        if (!(await confirmDialog(confirmMessage, { destructive: true }))) return;

        try {
            await apiClient.delete(`/api/error-items/${item.id}/delete`);
            toast.success(t.common?.messages?.deleteSuccess || 'Deleted successfully');
            if (item.subjectId) {
                router.push(`/notebooks/${item.subjectId}`);
            } else {
                router.push('/notebooks');
            }
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.deleteFailed || 'Delete failed');
        }
    };

    const startEditingNotes = () => {
        setNotesInput(item?.userNotes || "");
        setIsEditingNotes(true);
    };

    const cancelEditingNotes = () => {
        setIsEditingNotes(false);
        setNotesInput("");
    };

    const startEditingTags = () => {
        if (item) {
            // 优先使用新的 tags 关联
            if (item.tags && item.tags.length > 0) {
                setTagsInput(item.tags.map(t => t.name));
            } else if (item.knowledgePoints) {
                // 回退到旧的 knowledgePoints 字段
                try {
                    const tags = JSON.parse(item.knowledgePoints);
                    setTagsInput(tags);
                } catch (e) {
                    setTagsInput([]);
                }
            } else {
                setTagsInput([]);
            }
            setIsEditingTags(true);
        }
    };

    const saveTagsHandler = async () => {
        try {
            // 直接传递标签名称数组，后端会处理关联
            await apiClient.put(`/api/error-items/${item?.id}`, {
                knowledgePoints: tagsInput, // 后端接收数组
            });

            setIsEditingTags(false);
            await fetchItem(params.id as string);
            toast.success(t.common?.messages?.tagUpdateSuccess || 'Tags updated successfully!');
        } catch (error) {
            console.error("[Frontend] Error updating:", error);
            toast.error(t.common?.messages?.updateFailed || 'Update failed');
        }
    };

    const cancelEditingTags = () => {
        setIsEditingTags(false);
        setTagsInput([]);
    };

    const startEditingMetadata = () => {
        if (item) {
            setNotebookInput(item.subjectId || null);
            setGradeSemesterInput(item.gradeSemester || "");
            setPaperLevelInput(item.paperLevel || getDefaultPaperLevel(item.difficultyStars) || "a");
            setIsEditingMetadata(true);
        }
    };

    const saveMetadataHandler = async () => {
        try {
            await apiClient.put(`/api/error-items/${item?.id}`, {
                subjectId: notebookInput || null,
                gradeSemester: gradeSemesterInput,
                paperLevel: paperLevelInput,
            });

            setIsEditingMetadata(false);
            fetchItem(params.id as string);
            toast.success(t.common?.messages?.metaUpdateSuccess || 'Metadata updated successfully!');
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.updateFailed || 'Update failed');
        }
    };

    const cancelEditingMetadata = () => {
        setIsEditingMetadata(false);
        setNotebookInput(null);
        setGradeSemesterInput("");
        setPaperLevelInput("a");
    };

    const [isEditingQuestion, setIsEditingQuestion] = useState(false);
    const [questionInput, setQuestionInput] = useState("");

    const [isEditingAnswer, setIsEditingAnswer] = useState(false);
    const [answerInput, setAnswerInput] = useState("");

    const [isEditingAnalysis, setIsEditingAnalysis] = useState(false);
    const [analysisInput, setAnalysisInput] = useState("");

    const [isEditingWrongAnswer, setIsEditingWrongAnswer] = useState(false);
    const [isEditingMistakeAnalysis, setIsEditingMistakeAnalysis] = useState(false);
    const [wrongAnswerInput, setWrongAnswerInput] = useState("");
    const [mistakeAnalysisInput, setMistakeAnalysisInput] = useState("");
    const [mistakeStatusInput, setMistakeStatusInput] = useState("unknown");

    // --- Question Handlers ---
    const startEditingQuestion = () => {
        if (item) {
            setQuestionInput(item.questionText);
            setIsEditingQuestion(true);
        }
    };

    const saveQuestionHandler = async () => {
        try {
            await apiClient.put(`/api/error-items/${item?.id}`, { questionText: questionInput });
            setIsEditingQuestion(false);
            if (item) setItem({ ...item, questionText: questionInput });
            toast.success(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingQuestion = () => {
        setIsEditingQuestion(false);
        setQuestionInput("");
    };

    // --- Answer Handlers ---
    const startEditingAnswer = () => {
        if (item) {
            setAnswerInput(item.answerText);
            setIsEditingAnswer(true);
        }
    };

    const saveAnswerHandler = async () => {
        try {
            await apiClient.put(`/api/error-items/${item?.id}`, { answerText: answerInput });
            setIsEditingAnswer(false);
            if (item) setItem({ ...item, answerText: answerInput });
            toast.success(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingAnswer = () => {
        setIsEditingAnswer(false);
        setAnswerInput("");
    };

    // --- Analysis Handlers ---
    const startEditingAnalysis = () => {
        if (item) {
            setAnalysisInput(item.analysis);
            setIsEditingAnalysis(true);
        }
    };

    const saveAnalysisHandler = async () => {
        try {
            await apiClient.put(`/api/error-items/${item?.id}`, { analysis: analysisInput });
            setIsEditingAnalysis(false);
            if (item) setItem({ ...item, analysis: analysisInput });
            toast.success(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingAnalysis = () => {
        setIsEditingAnalysis(false);
        setAnalysisInput("");
    };

    // --- 错误解答（含作答状态）与错因分析：两个卡片各自编辑、各自保存 ---
    const startEditingWrongAnswer = () => {
        if (item) {
            setWrongAnswerInput(item.wrongAnswerText || "");
            setMistakeStatusInput(item.mistakeStatus || "unknown");
            setIsEditingWrongAnswer(true);
        }
    };

    const saveWrongAnswerHandler = async () => {
        if (!item) return;
        try {
            const normalizedStatus = normalizeMistakeStatusForSave(mistakeStatusInput, wrongAnswerInput);
            await apiClient.put(`/api/error-items/${item.id}`, {
                wrongAnswerText: wrongAnswerInput,
                mistakeStatus: normalizedStatus,
            });
            setIsEditingWrongAnswer(false);
            setItem((current) => current && { ...current, wrongAnswerText: wrongAnswerInput, mistakeStatus: normalizedStatus });
            toast.success(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingWrongAnswer = () => {
        setIsEditingWrongAnswer(false);
        setWrongAnswerInput("");
        setMistakeStatusInput("unknown");
    };

    const startEditingMistakeAnalysis = () => {
        if (item) {
            setMistakeAnalysisInput(item.mistakeAnalysis || "");
            setIsEditingMistakeAnalysis(true);
        }
    };

    const saveMistakeAnalysisHandler = async () => {
        if (!item) return;
        try {
            await apiClient.put(`/api/error-items/${item.id}`, { mistakeAnalysis: mistakeAnalysisInput });
            setIsEditingMistakeAnalysis(false);
            setItem((current) => current && { ...current, mistakeAnalysis: mistakeAnalysisInput });
            toast.success(t.common?.messages?.saveSuccess || 'Saved successfully');
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    const cancelEditingMistakeAnalysis = () => {
        setIsEditingMistakeAnalysis(false);
        setMistakeAnalysisInput("");
    };

    const saveNotes = async () => {
        if (!item) return;

        try {
            await apiClient.patch(`/api/error-items/${item.id}/notes`, { userNotes: notesInput });
            setItem({ ...item, userNotes: notesInput });
            setIsEditingNotes(false);
            toast.success(t.common?.messages?.noteSaveSuccess || 'Notes saved successfully');
        } catch (error) {
            console.error(error);
            toast.error(t.common?.messages?.saveFailed || 'Save failed');
        }
    };

    useEffect(() => {
        const handleScroll = () => {
            if (!questionRef.current) return;
            const rect = questionRef.current.getBoundingClientRect();
            if (rect.bottom < -50) {
                setShowFloatingQuestion(true);
            } else {
                setShowFloatingQuestion(false);
            }
        };
        window.addEventListener("scroll", handleScroll, { passive: true });
        handleScroll();
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    if (loading) return <PageLoading label={t.common.loading} />;
    if (!item) return <EmptyState icon={FileQuestion} title={t.detail.notFound || "Item not found"} className="m-4 md:m-8" />;

    // 优先从 tags 关联获取，回退到 knowledgePoints
    let tags: string[] = [];
    if (item.tags && item.tags.length > 0) {
        tags = item.tags.map(t => t.name);
    } else if (item.knowledgePoints) {
        try {
            const parsed = JSON.parse(item.knowledgePoints);
            tags = Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            tags = [];
        }
    }

    return (
        <main className="min-h-screen">
            <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 md:px-8 md:py-8">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        <Link href={item.subjectId ? `/notebooks/${item.subjectId}` : "/notebooks"}>
                            <Button variant="ghost" size="icon" className="-ml-2">
                                <ArrowLeft className="h-5 w-5" />
                            </Button>
                        </Link>
                        <h1 className="text-2xl font-bold tracking-tight">{t.detail.title}</h1>
                        <ShortIdBadge shortId={item.shortId} />
                        <DifficultyStars size="md" value={item.difficultyStars} onChange={handleDifficultyChange} disabled={savingDifficulty} />
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <FixLatexButton errorItemId={item.id} fields={item} onDone={handleLatexFixed} />
                        <Link href={`/practice?id=${item.id}`}>
                            <Button variant="outline" size="sm">
                                <RefreshCw className="mr-2 h-4 w-4" />
                                {t.detail.practice}
                            </Button>
                        </Link>
                        {masteryStatus && <MasteryStatusBadge status={masteryStatus} className="h-8 self-center px-3" />}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={deleteItem}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {t.detail.delete || "Delete"}
                        </Button>
                    </div>
                </div>

                <Card>
                    <CardHeader><div className="flex justify-between items-center"><CardTitle>{t.detail.question}</CardTitle>{!isEditingQuestion && <Button variant="ghost" size="sm" onClick={startEditingQuestion}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader>
                    <CardContent className="space-y-4">
                        {isEditingQuestion ? (
                            <div className="space-y-3">
                                <MarkdownEditor value={questionInput} onChange={setQuestionInput} placeholder="Enter question text..." rows={8} className="w-full font-mono text-sm" />
                                <div className="flex gap-2"><Button size="sm" onClick={saveQuestionHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingQuestion}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div>
                            </div>
                        ) : <><MarkdownRenderer content={item.questionText} /><QuestionFigure svg={item.figureSvg} /></>}

                        <div className="space-y-2">
                            <div className="flex justify-between items-center"><h4 className="text-sm font-semibold">{t.editor?.tags || "Knowledge Tags"}</h4>{!isEditingTags && <div className="flex"><RetagItemButton errorItemId={item.id} onDone={() => fetchItem(item.id)} /><Button variant="ghost" size="sm" onClick={startEditingTags}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button></div>}</div>
                            {isEditingTags ? (
                                <div className="space-y-3">
                                    <TagInput value={tagsInput} onChange={setTagsInput} placeholder={t.editor?.tagsPlaceholder || "Enter or select knowledge tags..."} subject={inferSubjectFromName(item.subject?.name || null) || undefined} gradeStage={educationStage} />
                                    <p className="text-xs text-muted-foreground">{t.editor?.tagsHint || "Select from standard or custom tags"}</p>
                                    <div className="flex flex-wrap gap-2"><Button size="sm" onClick={saveTagsHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingTags}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button><RetagItemButton errorItemId={item.id} onSuggested={setTagsInput} /></div>
                                </div>
                            ) : <div className="flex flex-wrap gap-2">{tags.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}</div>}
                        </div>

                        <div className="space-y-2 pt-4 border-t">
                            <div className="flex justify-between items-center"><h4 className="text-sm font-semibold">{t.detail?.questionInfo || "Question Info"}</h4>{!isEditingMetadata && <Button variant="ghost" size="sm" onClick={startEditingMetadata}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div>
                            {isEditingMetadata ? (
                                <div className="space-y-3">
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.notebooks?.title || "Notebook"}</label><NotebookSelector value={notebookInput || undefined} onChange={setNotebookInput} /></div>
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.filter.grade}</label><Input value={gradeSemesterInput} onChange={e => setGradeSemesterInput(e.target.value)} placeholder={t.notebook?.gradeSemesterPlaceholder || "e.g. Grade 7, Semester 1"} /></div>
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.filter.paperLevel}</label><Select value={paperLevelInput} onValueChange={setPaperLevelInput}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a">{t.editor.paperLevels?.a || "Paper A"}</SelectItem><SelectItem value="b">{t.editor.paperLevels?.b || "Paper B"}</SelectItem><SelectItem value="other">{t.editor.paperLevels?.other || "Other"}</SelectItem></SelectContent></Select></div>
                                    <div className="flex gap-2"><Button size="sm" onClick={saveMetadataHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingMetadata}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div>
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t.notebooks?.title || "Notebook"}:</span><span className="font-medium">{item.subject?.name || (t.common?.notSet || "Not set")}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t.filter.grade}:</span><span className="font-medium">{item.gradeSemester || (t.common?.notSet || "Not set")}</span></div>
                                    <div className="flex justify-between"><span className="text-muted-foreground">{t.filter.paperLevel}:</span><span className="font-medium">{item.paperLevel ? (t.editor.paperLevels?.[item.paperLevel as "a" | "b" | "other"] || item.paperLevel) : (t.common?.notSet || "Not set")}</span></div>
                                </div>
                            )}
                        </div>

                        <div className="pt-3">
                            <div className="flex flex-wrap gap-2">
                                {item.originalImageUrl && (
                                    <Button variant="outline" size="sm" onClick={() => setShowQuestionImage(!showQuestionImage)} className="flex items-center gap-2">
                                        {showQuestionImage ? <><EyeOff className="h-4 w-4" />{t.replaceImage?.hide || "Hide original image"}</> : <><ImageIcon className="h-4 w-4" />{t.replaceImage?.view || "View original image"}</>}
                                    </Button>
                                )}
                                <ReplaceQuestionImageButton
                                    errorItemId={item.id}
                                    hasImage={!!item.originalImageUrl}
                                    onDone={(originalImageUrl) => { setItem((current) => current && { ...current, originalImageUrl }); setShowQuestionImage(true); }}
                                />
                                {item.originalImageUrl && <RegenerateFigureButton errorItemId={item.id} onDone={(figure) => setItem((current) => current && { ...current, ...figure })} />}
                            </div>
                            {item.originalImageUrl && showQuestionImage && <div className="mt-4"><img src={item.originalImageUrl} alt={t.detail.originalProblem || "Original Problem"} className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setIsImageViewerOpen(true)} /><p className="text-xs text-muted-foreground mt-1 text-center">{t.detail?.clickToEnlarge || "Click to enlarge"}</p></div>}
                        </div>
                    </CardContent>
                </Card>

                <MasteryPanel errorItemId={item.id} onMasteryStatusChange={setMasteryStatus} />

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card className="border-primary/20">
                        <CardHeader><div className="flex justify-between items-center"><CardTitle className="text-primary">{t.detail.correctAnswer}</CardTitle>{!isEditingAnswer && <div className="flex flex-wrap justify-end"><RegenerateAnswerButton errorItemId={item.id} onDone={handleAnswerRegenerated} /><Button variant="ghost" size="sm" onClick={startEditingAnswer}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button></div>}</div></CardHeader>
                        <CardContent className="space-y-4">
                            {isEditingAnswer ? (
                                <div className="space-y-3"><MarkdownEditor value={answerInput} onChange={setAnswerInput} placeholder="Enter answer..." rows={5} className="w-full font-mono text-sm" /><div className="flex gap-2"><Button size="sm" onClick={saveAnswerHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingAnswer}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div></div>
                            ) : <MarkdownRenderer content={item.answerText} className="font-semibold" />}
                            {item.referenceImageUrl && <div className="pt-3"><Button variant="ghost" size="sm" onClick={() => setShowReferenceImage(!showReferenceImage)} className="flex items-center gap-2 text-muted-foreground">{showReferenceImage ? <><EyeOff className="h-4 w-4" />隐藏图片</> : <><ImageIcon className="h-4 w-4" />查看图片</>}</Button>{showReferenceImage && <div className="mt-4"><img src={item.referenceImageUrl} alt="参考图片" className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setIsImageViewerOpen(true)} /><p className="text-xs text-muted-foreground mt-1 text-center">{t.detail?.clickToEnlarge || "Click to enlarge"}</p></div>}</div>}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><div className="flex justify-between items-center"><CardTitle>{t.editor?.wrongAnswerText || "我的答案"}</CardTitle>{!isEditingWrongAnswer && <Button variant="ghost" size="sm" onClick={startEditingWrongAnswer}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader>
                        <CardContent className="space-y-4">
                            {isEditingWrongAnswer ? (
                                <div className="space-y-4">
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.editor?.mistakeStatus || "作答状态"}</label><Select value={mistakeStatusInput} onValueChange={setMistakeStatusInput}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="not_attempted">{t.editor?.mistakeStatuses?.notAttempted || "不会做"}</SelectItem><SelectItem value="wrong_attempt">{t.editor?.mistakeStatuses?.wrongAttempt || "做错了"}</SelectItem><SelectItem value="unknown">{t.editor?.mistakeStatuses?.unknown || "未判断"}</SelectItem></SelectContent></Select></div>
                                    <div className="space-y-2"><label className="text-sm text-muted-foreground">{t.editor?.wrongAnswerText || "错误解答原文"}</label><MarkdownEditor value={wrongAnswerInput} onChange={value => { setWrongAnswerInput(value); if (value.trim()) setMistakeStatusInput("wrong_attempt"); }} rows={5} className="w-full font-mono text-sm" /></div>
                                    <div className="flex gap-2"><Button size="sm" onClick={saveWrongAnswerHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingWrongAnswer}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <Badge variant="secondary">{getMistakeStatusLabel(item.mistakeStatus, language)}</Badge>
                                    {item.wrongAnswerText ? <MarkdownRenderer content={item.wrongAnswerText} /> : <p className="text-sm text-muted-foreground italic">{t.detail?.noMistakeAnalysis || "暂无错误解答"}</p>}
                                    {item.wrongAnswerImageUrl && <div className="pt-3"><Button variant="ghost" size="sm" onClick={() => setShowOwnImage(!showOwnImage)} className="flex items-center gap-2 text-muted-foreground">{showOwnImage ? <><EyeOff className="h-4 w-4" />隐藏图片</> : <><ImageIcon className="h-4 w-4" />查看图片</>}</Button>{showOwnImage && <div className="mt-4"><img src={item.wrongAnswerImageUrl} alt="我的答案图片" className="w-full rounded-lg border cursor-pointer hover:opacity-90 transition-opacity" onClick={() => setIsImageViewerOpen(true)} /><p className="text-xs text-muted-foreground mt-1 text-center">{t.detail?.clickToEnlarge || "Click to enlarge"}</p></div>}</div>}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>{t.detail.analysis}</CardTitle>{!isEditingAnalysis && <Button variant="ghost" size="sm" onClick={startEditingAnalysis}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader><CardContent>{isEditingAnalysis ? (<div className="space-y-3"><MarkdownEditor value={analysisInput} onChange={setAnalysisInput} placeholder="Enter analysis..." rows={12} className="w-full font-mono text-sm" /><div className="flex gap-2"><Button size="sm" onClick={saveAnalysisHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingAnalysis}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div></div>) : <MarkdownRenderer content={item.analysis} />}</CardContent></Card>
                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>{t.detail?.mistakeAnalysis || "错因分析"}</CardTitle>{!isEditingMistakeAnalysis && <Button variant="ghost" size="sm" onClick={startEditingMistakeAnalysis}><Edit className="h-4 w-4 mr-1" />{t.common?.edit || "Edit"}</Button>}</div></CardHeader><CardContent>{isEditingMistakeAnalysis ? (<div className="space-y-4"><div className="space-y-2"><label className="text-sm text-muted-foreground">{t.editor?.mistakeAnalysis || "错因分析"}</label><MarkdownEditor value={mistakeAnalysisInput} onChange={setMistakeAnalysisInput} rows={8} className="w-full font-mono text-sm" /></div><div className="flex gap-2"><Button size="sm" onClick={saveMistakeAnalysisHandler}><Save className="h-4 w-4 mr-1" />{t.common?.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingMistakeAnalysis}><X className="h-4 w-4 mr-1" />{t.common?.cancel || "Cancel"}</Button></div></div>) : item.mistakeAnalysis ? <MarkdownRenderer content={item.mistakeAnalysis} /> : <p className="text-sm text-muted-foreground italic">{t.detail?.noMistakeAnalysis || "暂无错因分析"}</p>}</CardContent></Card>
                </div>

                <div className="space-y-6">
                    {svgAnimationEnabled && (
                        // 切换界面语言时自动显示对应语言的动画；key 让播放器随语言重新加载
                        <SvgAnimationExplainer
                            key={language}
                            errorItemId={item.id}
                            svgAnimation={language === 'en' ? item.svgAnimationEn : item.svgAnimation}
                            hasOtherLanguage={!!(language === 'en' ? item.svgAnimation : item.svgAnimationEn)}
                            onChange={handleSvgAnimationChange}
                        />
                    )}

                    {geogebraEnabled && (item.geogebraCommands ? (
                        <GeogebraDemo commands={item.geogebraCommands} height={700} showToolBar={true} showAlgebraInput={false} showMenuBar={false} onRegenerate={handleAnalyzeGeogebra} onSaveCommands={handleSaveGeogebraCommands} onDelete={handleDeleteGeogebra} />
                    ) : (
                        <div className="rounded-lg border border-dashed p-4"><div className="flex items-center justify-between"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Box className="h-4 w-4" /><span>GeoGebra 动态演示</span></div><Button variant="outline" size="sm" onClick={() => handleAnalyzeGeogebra()} disabled={isAnalyzingGeogebra}>{isAnalyzingGeogebra ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI 分析中...</> : <><Box className="mr-2 h-4 w-4" />生成演示</>}</Button></div>{geogebraError && <p className="text-xs text-muted-foreground mt-2">{geogebraError}</p>}<p className="text-xs text-muted-foreground mt-2">AI 将判断本题是否可以用 GeoGebra 进行动态演示，如适合则自动生成交互式图形</p></div>
                    ))}

                    <Card><CardHeader><div className="flex justify-between items-center"><CardTitle>{t.detail.yourNotes}</CardTitle>{!isEditingNotes && <Button variant="ghost" size="sm" onClick={startEditingNotes}><Edit className="h-4 w-4 mr-1" />{t.detail.editNotes || "Edit"}</Button>}</div></CardHeader><CardContent>{isEditingNotes ? (<div className="space-y-3"><Textarea value={notesInput} onChange={e => setNotesInput(e.target.value)} placeholder={t.detail.notesPlaceholder || "Enter your notes..."} rows={5} className="w-full" /><div className="flex gap-2"><Button size="sm" onClick={saveNotes}><Save className="h-4 w-4 mr-1" />{t.common.save || "Save"}</Button><Button size="sm" variant="outline" onClick={cancelEditingNotes}><X className="h-4 w-4 mr-1" />{t.common.cancel || "Cancel"}</Button></div></div>) : <div className="whitespace-pre-wrap">{item.userNotes ? <p className="text-foreground">{item.userNotes}</p> : <p className="text-muted-foreground italic">{t.detail.noNotes}</p>}</div>}</CardContent></Card>
                </div>
            </div>

            {/* Image Viewer Modal */}
            {
                isImageViewerOpen && item?.originalImageUrl && (
                    <div
                        className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
                        onClick={() => setIsImageViewerOpen(false)}
                    >
                        <div className="relative max-w-7xl max-h-full">
                            <button
                                className="absolute -top-12 right-0 text-white hover:text-gray-300 text-lg font-semibold bg-black/50 px-4 py-2 rounded"
                                onClick={() => setIsImageViewerOpen(false)}
                            >
                                {t.detail?.close || '✕ Close'}
                            </button>
                            <img
                                src={item.originalImageUrl}
                                alt="Full size"
                                className="max-w-full max-h-[90vh] object-contain rounded-lg"
                                onClick={(e) => e.stopPropagation()}
                            />
                            <p className="text-center text-white/70 text-sm mt-4">
                                {t.detail?.clickOutside || 'Click outside to close'}
                            </p>
                        </div>
                    </div>
                )
            }
        </main >
    );
}
