-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SavedProblem" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "SavedProblem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SavedProblem" ("algorithmId", "createdAt", "id", "inputJson", "mode", "notes", "sourceCode", "status", "tagsJson", "title", "updatedAt", "userId") SELECT "algorithmId", "createdAt", "id", "inputJson", "mode", "notes", "sourceCode", "status", "tagsJson", "title", "updatedAt", "userId" FROM "SavedProblem";
DROP TABLE "SavedProblem";
ALTER TABLE "new_SavedProblem" RENAME TO "SavedProblem";
CREATE INDEX "SavedProblem_userId_updatedAt_idx" ON "SavedProblem"("userId", "updatedAt");
CREATE INDEX "SavedProblem_userId_status_idx" ON "SavedProblem"("userId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
