import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/current-user";
import { unauthorized, notFound, badRequest, internalError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { previewRetagErrorItem, retagErrorItem } from "@/lib/retag";

const logger = createLogger('api:error-items:retag');

/**
 * POST /api/error-items/:id/retag
 * 用 AI 从当前知识点库中重新选取本题的知识点（替换系统标签，保留自定义标签）
 * 请求体 { preview: true } 时只返回建议的知识点，不保存
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const user = await getCurrentUser();
        if (!user) {
            return unauthorized("Authentication required");
        }

        const body = await req.json().catch(() => ({})) as { preview?: unknown };
        const result = body.preview === true
            ? await previewRetagErrorItem(id, user.id)
            : await retagErrorItem(id, user.id);
        return NextResponse.json(result);
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === 'ITEM_NOT_FOUND') {
            return notFound("Item not found");
        }
        if (['NO_QUESTION_TEXT', 'NO_AVAILABLE_TAGS', 'NO_TAGS_SELECTED'].includes(message)) {
            return badRequest(message);
        }
        logger.error({ error: message }, 'Error retagging item');
        // AI 错误码交给前端映射为提示文案
        return internalError(message.startsWith('AI_') ? message.split(':')[0] : "Failed to retag item");
    }
}
