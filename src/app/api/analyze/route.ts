import { NextResponse } from "next/server";
import { getAIService } from "@/lib/ai";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { calculateGradeNumber } from "@/lib/knowledge-tags";
import { calculateGrade } from "@/lib/grade-calculator";
import { prisma } from "@/lib/prisma";
import { badRequest, internalError, createErrorResponse, ErrorCode } from "@/lib/api-errors";
import type { CandidateTags, GradeLevel } from "@/lib/ai/types";
import { getNotebookCandidateTags } from "@/lib/ai/tag-service";
import { resolveNotebookScope, SUBJECT_DISPLAY_NAMES } from "@/lib/notebook-scope";
import { createLogger } from "@/lib/logger";
import { getAppTimeZone } from "@/lib/config";

const logger = createLogger('api:analyze');

export async function POST(req: Request) {
    logger.info('Analyze API called');

    const session = await getServerSession(authOptions);

    // 认证检查
    if (!session) {
        logger.warn('Unauthorized access attempt');
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await req.json();
        let { imageBase64, mimeType, language, subjectId } = body;

        logger.debug({
            imageLength: imageBase64?.length,
            mimeType,
            language,
            subjectId
        }, 'Request received');

        if (!imageBase64) {
            logger.warn('Missing image data');
            return badRequest("Missing image data");
        }

        // Parse Data URL if present
        if (imageBase64.startsWith('data:')) {
            const matches = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
            if (matches) {
                mimeType = matches[1];
                imageBase64 = matches[2];
                logger.debug({ mimeType, base64Length: imageBase64.length }, 'Parsed Data URL');
            }
        }

        // 先获取用户年级信息，用于动态生成 AI prompt 中的标签列表
        let userGrade: GradeLevel | null = null;
        let userGradeSemester: string | null = null;
        let subjectChinese: string | null = null;
        let candidateTags: CandidateTags | undefined;

        if (session?.user?.email) {
            try {
                // 获取用户信息
                const user = await prisma.user.findUnique({
                    where: { email: session.user.email },
                    select: { id: true, educationStage: true, enrollmentYear: true }
                });

                if (user) {
                    userGrade = calculateGradeNumber(user.educationStage, user.enrollmentYear, getAppTimeZone());
                    if (user.educationStage && user.enrollmentYear) {
                        userGradeSemester = calculateGrade(user.educationStage, user.enrollmentYear, new Date(), 'zh', getAppTimeZone());
                    }
                    logger.debug({ userGrade, userGradeSemester }, 'Calculated user grade');
                }

                // 错题本的学段 + 学科决定候选知识点：直接取该范围内的全部标签
                if (subjectId && user) {
                    const notebook = await prisma.subject.findUnique({
                        where: { id: subjectId },
                        select: { name: true, userId: true, stage: true, subjectKey: true }
                    });

                    if (notebook && notebook.userId === user.id) {
                        const scope = resolveNotebookScope(notebook);
                        subjectChinese = scope.subject ? SUBJECT_DISPLAY_NAMES[scope.subject] : null;
                        candidateTags = await getNotebookCandidateTags(scope);
                        logger.debug({ scope, candidateTagCount: candidateTags?.tags.length }, 'Notebook scope resolved');
                    }
                }
            } catch (error) {
                logger.error({ error }, 'Error fetching user/subject info');
                // 继续执行，不传递年级参数（会返回所有年级的标签）
            }
        }


        logger.info({ userGrade, userGradeSemester, subject: subjectChinese }, 'Calling AI service for image analysis');
        const aiService = getAIService();
        const analysisResult = await aiService.analyzeImage(imageBase64, mimeType, language, userGrade, subjectChinese, userGradeSemester, candidateTags);

        logger.debug({
            knowledgePointsCount: analysisResult.knowledgePoints?.length,
            knowledgePointsType: typeof analysisResult.knowledgePoints,
            isArray: Array.isArray(analysisResult.knowledgePoints)
        }, 'AI returned knowledge points');

        // AI 现在从数据库获取标签列表，返回的标签已经是标准化的，不需要额外处理
        if (!analysisResult.knowledgePoints || analysisResult.knowledgePoints.length === 0) {
            logger.warn('Knowledge points is empty or null');
        }

        logger.info('AI analysis successful');

        return NextResponse.json(analysisResult);
    } catch (error: any) {
        logger.error({
            error: error.message,
            stack: error.stack
        }, 'Analysis error occurred');

        // 返回具体的错误类型，便于前端显示详细提示
        let errorMessage = error.message || "Failed to analyze image";

        // 识别特定错误类型
        if (error.message && (
            error.message === 'AI_CONNECTION_FAILED' ||
            error.message === 'AI_RESPONSE_ERROR' ||
            error.message.includes('AI_AUTH_ERROR') ||
            error.message === 'AI_TIMEOUT_ERROR' ||
            error.message === 'AI_QUOTA_EXCEEDED' ||
            error.message === 'AI_PERMISSION_DENIED' ||
            error.message === 'AI_NOT_FOUND' ||
            error.message === 'AI_SERVICE_UNAVAILABLE' ||
            error.message === 'AI_UNKNOWN_ERROR' ||
            error.message === 'AI_OUTPUT_TRUNCATED'
        )) {
            // 直接传递 AI Provider 定义的错误类型 (如果是 AI_AUTH_ERROR，提取出来)
            if (error.message.includes('AI_AUTH_ERROR')) {
                errorMessage = 'AI_AUTH_ERROR';
            } else {
                errorMessage = error.message;
            }
        } else if (error.message?.includes('Zod') || error.message?.includes('validate')) {
            // Zod 验证错误
            errorMessage = 'AI_RESPONSE_ERROR';
        }

        return createErrorResponse(errorMessage, 500, ErrorCode.AI_ERROR, error.message);
    }
}
