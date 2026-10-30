-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "geoLat" REAL;
ALTER TABLE "Organization" ADD COLUMN "geoLng" REAL;
ALTER TABLE "Organization" ADD COLUMN "geoRadiusM" INTEGER;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_TimeEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "clockIn" DATETIME NOT NULL,
    "clockOut" DATETIME,
    "inLat" REAL,
    "inLng" REAL,
    "outLat" REAL,
    "outLng" REAL,
    "note" TEXT,
    "outsideIn" BOOLEAN NOT NULL DEFAULT false,
    "outsideOut" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "TimeEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_TimeEntry" ("clockIn", "clockOut", "id", "inLat", "inLng", "note", "orgId", "outLat", "outLng", "userId", "userName") SELECT "clockIn", "clockOut", "id", "inLat", "inLng", "note", "orgId", "outLat", "outLng", "userId", "userName" FROM "TimeEntry";
DROP TABLE "TimeEntry";
ALTER TABLE "new_TimeEntry" RENAME TO "TimeEntry";
CREATE INDEX "TimeEntry_orgId_clockIn_idx" ON "TimeEntry"("orgId", "clockIn");
CREATE INDEX "TimeEntry_userId_clockOut_idx" ON "TimeEntry"("userId", "clockOut");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
