-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SavedProblem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'library',
    "algorithmId" TEXT,
    "sourceCode" TEXT,
    "inputJson" TEXT NOT NULL,
    "tagsJson" TEXT NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'revisit',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PracticeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "savedProblemId" TEXT,
    "eventId" TEXT NOT NULL,
    "algorithmId" TEXT,
    "practiceDate" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PracticeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PracticeLog_savedProblemId_fkey" FOREIGN KEY ("savedProblemId") REFERENCES "SavedProblem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
