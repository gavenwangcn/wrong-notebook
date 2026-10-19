"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { apiClient } from "@/lib/api-client";
import { frontendLogger } from "@/lib/frontend-logger";
import { processImageFile } from "@/lib/image-utils";

interface ReplaceQuestionImageButtonProps {
    errorItemId: string;
    /** 题目已有原图时替换前二次确认 */
    hasImage: boolean;
    onDone: (originalImageUrl: string) => void;
}

/** 选择新图片（超过 1MB 时压缩）替换原题图片 */
export function ReplaceQuestionImageButton({ errorItemId, hasImage, onDone }: ReplaceQuestionImageButtonProps) {
    const { t } = useLanguage();
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleClick = () => {
        if (hasImage && !confirm(t.replaceImage.confirm)) return;
        inputRef.current?.click();
    };

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) {
            alert(t.replaceImage.invalid);
            return;
        }
        setUploading(true);
        try {
            const imageDataUrl = await processImageFile(file);
            const result = await apiClient.put<{ originalImageUrl: string }>(`/api/error-items/${errorItemId}/image`, { imageDataUrl });
            onDone(result.originalImageUrl);
            alert(t.replaceImage.done);
        } catch (error) {
            const code = (error as { data?: { message?: string } })?.data?.message || "";
            frontendLogger.error('[ReplaceImage]', 'Failed to replace original image', { code });
            alert(code === "INVALID_IMAGE" ? t.replaceImage.invalid : t.replaceImage.failed);
        } finally {
            setUploading(false);
        }
    };

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => {
                    void handleFile(e.target.files?.[0]);
                    e.target.value = "";
                }}
            />
            <Button variant="outline" size="sm" onClick={handleClick} disabled={uploading} className="flex items-center gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {uploading ? t.replaceImage.uploading : hasImage ? t.replaceImage.replace : t.replaceImage.add}
            </Button>
        </>
    );
}
