-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedProblem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'library',
    "algorithmId" TEXT,
    "sourceCode" TEXT,
    "language" TEXT,
    "visualVariable" TEXT NOT NULL DEFAULT '',
    "inputJson" TEXT NOT NULL,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'revisit',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedProblem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "savedProblemId" TEXT,
    "eventId" TEXT NOT NULL,
    "algorithmId" TEXT,
    "practiceDate" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PracticeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "SavedProblem_userId_updatedAt_idx" ON "SavedProblem"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "SavedProblem_userId_status_idx" ON "SavedProblem"("userId", "status");

-- CreateIndex
CREATE INDEX "PracticeLog_userId_practiceDate_idx" ON "PracticeLog"("userId", "practiceDate");

-- CreateIndex
CREATE UNIQUE INDEX "PracticeLog_userId_eventId_key" ON "PracticeLog"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "SavedProblem" ADD CONSTRAINT "SavedProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeLog" ADD CONSTRAINT "PracticeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeLog" ADD CONSTRAINT "PracticeLog_savedProblemId_fkey" FOREIGN KEY ("savedProblemId") REFERENCES "SavedProblem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

