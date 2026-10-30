-- CreateTable
CREATE TABLE "WorkspaceSnapshot" (
    "orgId" TEXT NOT NULL PRIMARY KEY,
    "json" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkspaceSnapshot_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PublicLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "signedName" TEXT,
    "signedAt" DATETIME,
    "chosenOption" TEXT,
    "paidAmount" REAL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PublicLink_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Automation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "afterDays" INTEGER NOT NULL DEFAULT 3,
    "lastRunAt" DATETIME,
    CONSTRAINT "Automation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Certification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "technician" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "serviceType" TEXT,
    "expiresOn" DATETIME NOT NULL,
    CONSTRAINT "Certification_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
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
    "arrivalWindowMins" INTEGER NOT NULL DEFAULT 120,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Organization" ("createdAt", "currency", "hoursEnd", "hoursStart", "id", "industry", "name", "onboardedAt", "onboardingStep", "sampleData", "serviceTypes", "taxPct", "timezone", "zones") SELECT "createdAt", "currency", "hoursEnd", "hoursStart", "id", "industry", "name", "onboardedAt", "onboardingStep", "sampleData", "serviceTypes", "taxPct", "timezone", "zones" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PublicLink_tokenHash_key" ON "PublicLink"("tokenHash");

-- CreateIndex
CREATE INDEX "PublicLink_orgId_kind_ref_idx" ON "PublicLink"("orgId", "kind", "ref");

-- CreateIndex
CREATE INDEX "NotificationLog_orgId_at_idx" ON "NotificationLog"("orgId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Automation_orgId_key_key" ON "Automation"("orgId", "key");

-- CreateIndex
CREATE INDEX "Certification_orgId_technician_idx" ON "Certification"("orgId", "technician");
