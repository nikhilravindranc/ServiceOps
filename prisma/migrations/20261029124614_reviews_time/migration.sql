-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Review_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeEntry" (
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
    CONSTRAINT "TimeEntry_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Organization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "taxPct" REAL NOT NULL DEFAULT 18,
    "hoursStart" TEXT NOT NULL DEFAULT '08:00',
    "hoursEnd" TEXT NOT NULL DEFAULT '17:00',
    "serviceTypes" TEXT NOT NULL DEFAULT '[]',
    "zones" TEXT NOT NULL DEFAULT '[]',
    "sampleData" BOOLEAN NOT NULL DEFAULT true,
    "onboardingStep" INTEGER NOT NULL DEFAULT 0,
    "onboardedAt" DATETIME,
    "slug" TEXT,
    "bookingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "revenueGoal" REAL NOT NULL DEFAULT 0,
    "arrivalWindowMins" INTEGER NOT NULL DEFAULT 120,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Organization" ("arrivalWindowMins", "bookingEnabled", "createdAt", "currency", "hoursEnd", "hoursStart", "id", "industry", "name", "onboardedAt", "onboardingStep", "sampleData", "serviceTypes", "slug", "taxPct", "timezone", "zones") SELECT "arrivalWindowMins", "bookingEnabled", "createdAt", "currency", "hoursEnd", "hoursStart", "id", "industry", "name", "onboardedAt", "onboardingStep", "sampleData", "serviceTypes", "slug", "taxPct", "timezone", "zones" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Review_orgId_at_idx" ON "Review"("orgId", "at");

-- CreateIndex
CREATE INDEX "TimeEntry_orgId_clockIn_idx" ON "TimeEntry"("orgId", "clockIn");

-- CreateIndex
CREATE INDEX "TimeEntry_userId_clockOut_idx" ON "TimeEntry"("userId", "clockOut");
