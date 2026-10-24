"use client";

import { useState, Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { UploadZone } from "@/components/upload-zone";
import { CorrectionEditor } from "@/components/correction-editor";
import { ImageCropper } from "@/components/image-cropper";
import { ParsedQuestion } from "@/lib/ai";
import { HomeHero } from "@/components/home-hero";
import { apiClient } from "@/lib/api-client";
import { AnalyzeResponse, Notebook, AppConfig } from "@/types/api";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePageTitle } from "@/lib/page-title";
import { processImageFile } from "@/lib/image-utils";
import { Camera, PenLine, Sparkles } from "lucide-react";

import { PageLoading } from "@/components/ui/page-loading";
import { ProgressFeedback } from "@/components/ui/progress-feedback";
import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ProgressStatus } from "@/components/ui/progress-feedback";
import { frontendLogger } from "@/lib/frontend-logger";
import { TextInputZone } from "@/components/text-input-zone";
import { ImportResultBanner } from "@/components/import-result-banner";
import { BatchImportPanel } from "@/components/batch-import-panel";
import { fetchConfirmBeforeImport, saveParsedQuestion } from "@/lib/question-import";
import type { ImportedQuestion } from "@/lib/question-import";
import { DirectTextEditor } from "@/components/direct-text-editor";
import { toast } from "@/lib/feedback";
import { getApiErrorMessage, getErrorMessage } from "@/lib/error-message";
import { getAnalysisErrorMessage } from "@/lib/analysis-error";
import { normalizeMistakeStatus } from "@/lib/mistake-status";

function HomeContent() {
    const [step, setStep] = useState<"upload" | "review">("upload");
    const [analysisStep, setAnalysisStep] = useState<ProgressStatus>('idle');
    const [parsedData, setParsedData] = useState<ParsedQuestion | null>(null);
    const [currentImage, setCurrentImage] = useState<string | null>(null);
    const { t, language } = useLanguage();
    usePageTitle(t.pageTitle.home);
    const searchParams = useSearchParams();
    const router = useRouter();
    const initialNotebookId = searchParams.get("notebook");
    const [notebooks, setNotebooks] = useState<Notebook[]>([]);
    const [autoSelectedNotebookId, setAutoSelectedNotebookId] = useState<string | null>(null);

    const [config, setConfig] = useState<AppConfig | null>(null);

    // Input mode: "image" for photo upload, "text" for AI solve, "direct" for manual entry
    const [inputMode, setInputMode] = useState<"image" | "text" | "direct">("image");

    // Cropper state
    const [croppingImage, setCroppingImage] = useState<string | null>(null);
    const [isCropperOpen, setIsCropperOpen] = useState(false);

    // 免确认导入：偏好、最近一次导入结果、批量框选的题目图片
    const [confirmBeforeImport, setConfirmBeforeImport] = useState(false);
    const [lastImported, setLastImported] = useState<ImportedQuestion | null>(null);
    const [batchBlobs, setBatchBlobs] = useState<Blob[] | null>(null);

    // Timeout Config
    const aiTimeout = config?.timeouts?.analyze || 180000;
    const safetyTimeout = aiTimeout + 10000;

    // Cleanup Blob URL to prevent memory leak
    useEffect(() => {
        return () => {
            if (croppingImage) {
                URL.revokeObjectURL(croppingImage);
            }
        };
    }, [croppingImage]);

    useEffect(() => {
        // Fetch notebooks for auto-selection
        apiClient.get<Notebook[]>("/api/notebooks")
            .then(data => setNotebooks(data))
            .catch(err => frontendLogger.error('[Home]', 'Failed to fetch notebooks', { error: err }));

        fetchConfirmBeforeImport().then(setConfirmBeforeImport);

        // Fetch settings for timeouts
        apiClient.get<AppConfig>("/api/settings")
            .then(data => {
                setConfig(data);
                if (data.timeouts?.analyze) {
                    frontendLogger.info('[Config]', 'Loaded timeout settings', {
                        analyze: data.timeouts.analyze
                    });
                }
            })
            .catch(err => frontendLogger.error('[Home]', 'Failed to fetch config', { error: err }));
    }, []);

    // 保留按阶段计时的超时兜底，进度估值和已用时间由提示组件统一维护。
    useEffect(() => {
        if (analysisStep === 'idle') return;
        const timeout = setTimeout(() => {
            frontendLogger.warn('[Progress]', '处理超时，关闭进度提示', { analysisStep, safetyTimeout });
            setAnalysisStep('idle');
        }, safetyTimeout);
        return () => clearTimeout(timeout);
    }, [analysisStep, safetyTimeout]);

    const handleBatchCropComplete = (blobs: Blob[]) => {
        setIsCropperOpen(false);
        setLastImported(null);
        setBatchBlobs(blobs);
    };

    const onImageSelect = (file: File) => {
        setLastImported(null);
        const imageUrl = URL.createObjectURL(file);
        setCroppingImage(imageUrl);
        setIsCropperOpen(true);
    };

    const handleCropComplete = async (croppedBlob: Blob) => {
        setIsCropperOpen(false);
        // Convert Blob to File
        const file = new File([croppedBlob], "cropped-image.jpg", { type: "image/jpeg" });
        handleAnalyze(file);
    };

    const handleAnalyze = async (file: File) => {
        const startTime = Date.now();
        frontendLogger.info('[HomeAnalyze]', 'Starting analysis flow', {
            timeoutSettings: {
                apiTimeout: aiTimeout,
                safetyTimeout
            }
        });

        try {
            frontendLogger.info('[HomeAnalyze]', 'Step 1/5: Compressing image');
            setAnalysisStep('compressing');
            const base64Image = await processImageFile(file);
            setCurrentImage(base64Image);
            frontendLogger.info('[HomeAnalyze]', 'Image compressed successfully', {
                size: base64Image.length
            });

            frontendLogger.info('[HomeAnalyze]', 'Step 2/5: Calling API endpoint /api/analyze');
            setAnalysisStep('analyzing');
            const apiStartTime = Date.now();
            const data = await apiClient.post<AnalyzeResponse>("/api/analyze", {
                imageBase64: base64Image,
                language: language,
                subjectId: initialNotebookId || autoSelectedNotebookId || undefined
            }, { timeout: aiTimeout }); // Use configured timeout
            const apiDuration = Date.now() - apiStartTime;
            frontendLogger.info('[HomeAnalyze]', 'API response received, validating data', {
                apiDuration
            });

            // Validate response data
            if (!data || typeof data !== 'object') {
                frontendLogger.error('[HomeAnalyze]', 'Validation failed - invalid response data', {
                    data
                });
                throw new Error('Invalid API response: data is null or not an object');
            }
            frontendLogger.info('[HomeAnalyze]', 'Response data validated successfully');

            frontendLogger.info('[HomeAnalyze]', '开始处理 AI 返回结果');
            setAnalysisStep('processing');

            // 未开启人工确认时直接入库
            if (!confirmBeforeImport) {
                setAnalysisStep('saving');
                const imported = await saveParsedQuestion(data, { subjectId: initialNotebookId, imageUrl: base64Image });
                setLastImported(imported);
                setCurrentImage(null);
                frontendLogger.info('[HomeAnalyze]', 'Imported without review', { id: imported.id });
                return;
            }

            frontendLogger.info('[HomeAnalyze]', 'Step 4/5: Setting parsed data and auto-selecting notebook');
            const dataSize = JSON.stringify(data).length;
            // Auto-select notebook based on subject
            if (data.subject) {
                const matchedNotebook = notebooks.find(n =>
                    n.name.includes(data.subject!) || data.subject!.includes(n.name)
                );
                if (matchedNotebook) {
                    setAutoSelectedNotebookId(matchedNotebook.id);
                    frontendLogger.info('[HomeAnalyze]', 'Auto-selected notebook', {
                        notebook: matchedNotebook.name,
                        subject: data.subject
                    });
                }
            }
            const setDataStart = Date.now();
            setParsedData(data);
            const setDataDuration = Date.now() - setDataStart;
            frontendLogger.info('[HomeAnalyze]', 'Parsed data set successfully', {
                dataSize,
                setDataDuration
            });

            frontendLogger.info('[HomeAnalyze]', 'Step 5/5: Switching to review page');
            const setStepStart = Date.now();
            setStep("review");
            const setStepDuration = Date.now() - setStepStart;
            frontendLogger.info('[HomeAnalyze]', 'Step switched to review', {
                setStepDuration
            });
            const totalDuration = Date.now() - startTime;
            frontendLogger.info('[HomeAnalyze]', 'Analysis completed successfully', {
                totalDuration
            });
        } catch (error) {
            const errorDuration = Date.now() - startTime;
            frontendLogger.error('[HomeError]', 'Analysis failed', {
                errorDuration,
                error: getErrorMessage(error)
            });

            toast.error(getAnalysisErrorMessage(error, t));
        } finally {
            // Always reset analysis state, even if setState throws
            frontendLogger.info('[HomeAnalyze]', 'Finally: Resetting analysis state to idle');
            setAnalysisStep('idle');
            frontendLogger.info('[HomeAnalyze]', 'Analysis state reset complete');
        }
    };

    const handleSave = async (finalData: ParsedQuestion & { subjectId?: string }): Promise<void> => {
        frontendLogger.info('[HomeSave]', 'Starting save process', {
            hasQuestionText: !!finalData.questionText,
            hasAnswerText: !!finalData.answerText,
            subjectId: finalData.subjectId,
            knowledgePointsCount: finalData.knowledgePoints?.length || 0,
            hasImage: !!currentImage,
            imageSize: currentImage?.length || 0,
        });

        try {
            const result = await apiClient.post<{ id: string; duplicate?: boolean }>("/api/error-items", {
                ...finalData,
                originalImageUrl: currentImage || "",
            });

            // 检查是否是重复提交（后端去重返回）
            if (result.duplicate) {
                frontendLogger.info('[HomeSave]', 'Duplicate submission detected, using existing record');
            }

            frontendLogger.info('[HomeSave]', 'Save successful');
            setStep("upload");
            setParsedData(null);
            setCurrentImage(null);
            toast.success(result.duplicate ? t.importFlow.duplicate : t.common.messages.saveSuccess);

            // Redirect to notebook page if subjectId is present
            if (result.duplicate) {
                router.push(`/error-items/${result.id}`);
            } else if (finalData.subjectId) {
                router.push(`/notebooks/${finalData.subjectId}`);
            }
        } catch (error) {
            frontendLogger.error('[HomeSave]', 'Save failed', {
                errorMessage: getApiErrorMessage(error) ?? getErrorMessage(error),
            });
            toast.error(t.common?.messages?.saveFailed || 'Failed to save');
        }
    };

    const handleTextSubmit = async (questionText: string) => {
        const startTime = Date.now();
        frontendLogger.info('[HomeTextSubmit]', 'Starting text-based analysis', { textLength: questionText.length });

        try {
            setAnalysisStep('analyzing');

            // Infer subject from auto-selected notebook
            const targetNotebookId = initialNotebookId || autoSelectedNotebookId;
            const matchedNotebook = targetNotebookId
                ? notebooks.find(n => n.id === targetNotebookId)
                : undefined;

            const result = await apiClient.post<{
                answerText: string;
                analysis: string;
                knowledgePoints: string[];
                wrongAnswerText: string;
                mistakeAnalysis: string;
                mistakeStatus: string;
                difficultyStars?: number | null;
                subject?: string;
            }>("/api/reanswer", {
                questionText,
                language,
                subject: matchedNotebook?.name || undefined,
                subjectId: matchedNotebook?.id,
            }, { timeout: aiTimeout });

            setAnalysisStep('processing');

            const parsed: ParsedQuestion = {
                questionText,
                answerText: result.answerText,
                analysis: result.analysis,
                knowledgePoints: result.knowledgePoints || [],
                wrongAnswerText: result.wrongAnswerText || "",
                mistakeAnalysis: result.mistakeAnalysis || "",
                mistakeStatus: normalizeMistakeStatus(result.mistakeStatus),
                subject: (result.subject || "其他") as ParsedQuestion["subject"],
                requiresImage: false,
                difficultyStars: result.difficultyStars ?? null,
            };

            if (!confirmBeforeImport) {
                setAnalysisStep('saving');
                const imported = await saveParsedQuestion(parsed, { subjectId: initialNotebookId, imageUrl: null });
                setLastImported(imported);
                return;
            }

            setCurrentImage(null); // No image for text input
            setParsedData(parsed);
            setStep("review");

            const totalDuration = Date.now() - startTime;
            frontendLogger.info('[HomeTextSubmit]', 'Text analysis completed', { totalDuration });
        } catch (error) {
            const errorDuration = Date.now() - startTime;
            frontendLogger.error('[HomeTextSubmit]', 'Analysis failed', {
                errorDuration,
                error: getErrorMessage(error)
            });

            toast.error(getAnalysisErrorMessage(error, t));
        } finally {
            setAnalysisStep('idle');
        }
    };

    const handleDirectSave = async (data: {
        questionText: string;
        answerText: string;
        analysis: string;
        wrongAnswerText: string;
        mistakeAnalysis: string;
        mistakeStatus: string;
        knowledgePoints: string[];
        subjectId: string;
        gradeSemester?: string;
        paperLevel?: string;
    }): Promise<void> => {
        frontendLogger.info('[HomeDirectSave]', 'Starting direct save', {
            hasQuestionText: !!data.questionText,
            hasAnswerText: !!data.answerText,
            subjectId: data.subjectId,
        });

        try {
            setAnalysisStep('saving');
            const result = await apiClient.post<{ id: string; duplicate?: boolean }>("/api/error-items", {
                questionText: data.questionText,
                answerText: data.answerText,
                analysis: data.analysis,
                wrongAnswerText: data.wrongAnswerText || null,
                mistakeAnalysis: data.mistakeAnalysis || null,
                mistakeStatus: data.mistakeStatus || "unknown",
                knowledgePoints: data.knowledgePoints,
                subjectId: data.subjectId,
                gradeSemester: data.gradeSemester,
                paperLevel: data.paperLevel,
                originalImageUrl: "",
            });

            if (result.duplicate) {
                frontendLogger.info('[HomeDirectSave]', 'Duplicate detected');
            }

            frontendLogger.info('[HomeDirectSave]', 'Save successful');
            setAnalysisStep('idle');
            toast.success(result.duplicate ? t.importFlow.duplicate : t.common.messages.saveSuccess);

            if (result.duplicate) {
                router.push(`/error-items/${result.id}`);
            } else if (data.subjectId) {
                router.push(`/notebooks/${data.subjectId}`);
            }
        } catch (error) {
            frontendLogger.error('[HomeDirectSave]', 'Save failed', {
                errorMessage: getApiErrorMessage(error) ?? getErrorMessage(error),
            });
            setAnalysisStep('idle');
            toast.error(t.common?.messages?.saveFailed || 'Failed to save');
        }
    };

    const targetNotebookId = initialNotebookId || autoSelectedNotebookId;
    const targetNotebookName = targetNotebookId ? notebooks.find(n => n.id === targetNotebookId)?.name : undefined;
    const totalItems = notebooks.reduce((sum, n) => sum + (n._count?.errorItems || 0), 0);
    const inputModes = [
        { value: "image" as const, icon: Camera, label: t.app?.uploadImage || "拍照上传" },
        { value: "text" as const, icon: Sparkles, label: t.app?.manualInput || "AI解题" },
        { value: "direct" as const, icon: PenLine, label: t.app?.directInput || "直接录入" },
    ];

    return (
        <main className="min-h-screen">
            <ProgressFeedback status={analysisStep} />

            <div className={`mx-auto space-y-6 px-4 py-6 md:px-8 md:py-8 ${step === "review" ? "max-w-6xl" : "max-w-4xl"}`}>
                {step === "upload" && (
                    <>
                        <HomeHero
                            notebookCount={notebooks.length}
                            itemCount={totalItems}
                            targetNotebook={initialNotebookId ? targetNotebookName : undefined}
                        />

                        <div className="space-y-4">
                            <SegmentedControl options={inputModes} value={inputMode} onChange={setInputMode} />

                            {lastImported && (
                                <ImportResultBanner imported={lastImported} onDismiss={() => setLastImported(null)} />
                            )}

                            {batchBlobs ? (
                                <BatchImportPanel
                                    blobs={batchBlobs}
                                    subjectId={initialNotebookId}
                                    timeout={aiTimeout}
                                    onClose={() => setBatchBlobs(null)}
                                />
                            ) : inputMode === "image" ? (
                                <UploadZone onImageSelect={onImageSelect} isAnalyzing={analysisStep !== 'idle'} />
                            ) : inputMode === "text" ? (
                                <TextInputZone
                                    onSubmit={handleTextSubmit}
                                    isAnalyzing={analysisStep !== 'idle'}
                                    defaultNotebookName={targetNotebookName}
                                />
                            ) : (
                                <DirectTextEditor
                                    onSubmit={handleDirectSave}
                                    defaultNotebookId={targetNotebookId || undefined}
                                    defaultNotebookName={targetNotebookName}
                                    isSaving={analysisStep === 'saving'}
                                />
                            )}
                        </div>
                    </>
                )}

                {croppingImage && (
                    <ImageCropper
                        imageSrc={croppingImage}
                        open={isCropperOpen}
                        onClose={() => setIsCropperOpen(false)}
                        onCropComplete={handleCropComplete}
                        onMultiCropComplete={handleBatchCropComplete}
                    />
                )}

                {step === "review" && parsedData && (
                    <CorrectionEditor
                        initialData={parsedData}
                        onSave={handleSave}
                        onCancel={() => setStep("upload")}
                        imagePreview={currentImage}
                        initialSubjectId={initialNotebookId || autoSelectedNotebookId || undefined}
                        aiTimeout={aiTimeout}
                    />
                )}

            </div>
        </main>
    );
}

export default function Home() {
    return (
        <Suspense fallback={<PageLoading />}>
            <HomeContent />
        </Suspense>
    );
}
