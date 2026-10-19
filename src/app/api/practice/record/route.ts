import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { unauthorized, internalError, notFound, validationError } from "@/lib/api-errors";
import { createLogger } from "@/lib/logger";
import { PRACTICE_RESULTS, scheduleMasteryEvaluation } from "@/lib/mastery";
import { MAX_FIGURE_SVG_LENGTH, sanitizeFigureSvg } from "@/lib/figure-svg";

const logger = createLogger('api:practice:record');

const recordSchema = z.object({
    errorItemId: z.string().min(1).optional(),
    result: z.enum(PRACTICE_RESULTS as [string, ...string[]]).optional(),
    isCorrect: z.boolean().nullable().optional(),
    subject: z.string().max(50).nullable().optional(),
    difficulty: z.string().max(20).nullable().optional(),
    questionText: z.string().max(20000).nullable().optional(),
    answerText: z.string().max(20000).nullable().optional(),
    analysis: z.string().max(50000).nullable().optional(),
    figureSvg: z.string().max(MAX_FIGURE_SVG_LENGTH).nullable().optional(),
});

export async function POST(req: Request) {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
        return unauthorized();
    }

    try {
        const parsed = recordSchema.safeParse(await req.json());
        if (!parsed.success) {
            return validationError("Invalid practice record", parsed.error.issues);
        }
        const { errorItemId, subject, difficulty, questionText, answerText, analysis } = parsed.data;
        const figureSvg = sanitizeFigureSvg(parsed.data.figureSvg);
        // 兼容旧客户端只传 isCorrect 的情况
        const result = parsed.data.result
            ?? (parsed.data.isCorrect === true ? 'correct' : parsed.data.isCorrect === false ? 'wrong' : undefined);

        // @ts-ignore
        const userId = session.user.id;

        // 关联原题时校验归属，防止写入他人的错题
        if (errorItemId) {
            const item = await prisma.errorItem.findUnique({
                where: { id: errorItemId },
                select: { userId: true },
            });
            if (!item || item.userId !== userId) {
                return notFound("Item not found");
            }
        }

        const isCorrect = result ? result === 'correct' : parsed.data.isCorrect;

        const record = await prisma.practiceRecord.create({
            data: {
                userId,
                subject,
                difficulty,
                isCorrect,
                ...(errorItemId ? {
                    errorItemId,
                    result,
                    questionText,
                    answerText,
                    analysis,
                    figureSvg,
                    source: 'practice',
                } : {}),
            },
        });

        if (errorItemId && result) {
            scheduleMasteryEvaluation([errorItemId]);
        }

        return NextResponse.json(record);
    } catch (error) {
        logger.error({ error }, 'Error saving practice record');
        return internalError("Failed to save record");
    }
}
