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
    "homeBanner" TEXT NOT NULL DEFAULT 'photo',
    "homeBannerImage" TEXT,
    "geoLat" REAL,
    "geoLng" REAL,
    "geoRadiusM" INTEGER,
    "arrivalWindowMins" INTEGER NOT NULL DEFAULT 120,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Organization" ("arrivalWindowMins", "bookingEnabled", "createdAt", "currency", "geoLat", "geoLng", "geoRadiusM", "hoursEnd", "hoursStart", "id", "industry", "name", "onboardedAt", "onboardingStep", "revenueGoal", "sampleData", "serviceTypes", "slug", "taxPct", "timezone", "zones") SELECT "arrivalWindowMins", "bookingEnabled", "createdAt", "currency", "geoLat", "geoLng", "geoRadiusM", "hoursEnd", "hoursStart", "id", "industry", "name", "onboardedAt", "onboardingStep", "revenueGoal", "sampleData", "serviceTypes", "slug", "taxPct", "timezone", "zones" FROM "Organization";
DROP TABLE "Organization";
ALTER TABLE "new_Organization" RENAME TO "Organization";
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
