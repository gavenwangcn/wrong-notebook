-- 试卷题目与举一反三记录由一对一改为一对多，保留已有关联
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PracticeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "subject" TEXT,
    "difficulty" TEXT,
    "isCorrect" BOOLEAN,
    "errorItemId" TEXT,
    "result" TEXT,
    "questionText" TEXT,
    "answerText" TEXT,
    "analysis" TEXT,
    "wrongAnswerText" TEXT,
    "mistakeAnalysis" TEXT,
    "originalImageUrl" TEXT,
    "figureSvg" TEXT,
    "source" TEXT NOT NULL DEFAULT 'practice',
    "examQuestionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeRecord_errorItemId_fkey" FOREIGN KEY ("errorItemId") REFERENCES "ErrorItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeRecord_examQuestionId_fkey" FOREIGN KEY ("examQuestionId") REFERENCES "ExamQuestion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PracticeRecord" ("analysis", "answerText", "createdAt", "difficulty", "errorItemId", "figureSvg", "id", "isCorrect", "mistakeAnalysis", "originalImageUrl", "questionText", "result", "source", "subject", "userId", "wrongAnswerText", "examQuestionId") SELECT "analysis", "answerText", "createdAt", "difficulty", "errorItemId", "figureSvg", "id", "isCorrect", "mistakeAnalysis", "originalImageUrl", "questionText", "result", "source", "subject", "userId", "wrongAnswerText", (SELECT "ExamQuestion"."id" FROM "ExamQuestion" WHERE "ExamQuestion"."practiceRecordId" = "PracticeRecord"."id") FROM "PracticeRecord";
DROP TABLE "PracticeRecord";
ALTER TABLE "new_PracticeRecord" RENAME TO "PracticeRecord";
CREATE INDEX "PracticeRecord_errorItemId_createdAt_idx" ON "PracticeRecord"("errorItemId", "createdAt");
CREATE INDEX "PracticeRecord_examQuestionId_idx" ON "PracticeRecord"("examQuestionId");
CREATE TABLE "new_ExamQuestion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "paperId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "errorItemId" TEXT,
    "sourceShortId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "questionText" TEXT,
    "answerText" TEXT,
    "analysis" TEXT,
    "figureSvg" TEXT,
    "error" TEXT,
    CONSTRAINT "ExamQuestion_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "ExamPaper" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExamQuestion_errorItemId_fkey" FOREIGN KEY ("errorItemId") REFERENCES "ErrorItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ExamQuestion" ("analysis", "answerText", "error", "errorItemId", "figureSvg", "id", "order", "paperId", "questionText", "sourceShortId", "status") SELECT "analysis", "answerText", "error", "errorItemId", "figureSvg", "id", "order", "paperId", "questionText", "sourceShortId", "status" FROM "ExamQuestion";
DROP TABLE "ExamQuestion";
ALTER TABLE "new_ExamQuestion" RENAME TO "ExamQuestion";
CREATE INDEX "ExamQuestion_paperId_order_idx" ON "ExamQuestion"("paperId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

