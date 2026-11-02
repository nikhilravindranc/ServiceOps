-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "locationSharing" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "TechLocation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orgId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userName" TEXT NOT NULL,
    "jobId" INTEGER,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "accuracy" REAL,
    "at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "TechLocation_orgId_userId_at_idx" ON "TechLocation"("orgId", "userId", "at");
