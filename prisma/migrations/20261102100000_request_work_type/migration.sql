-- AlterTable
ALTER TABLE "Request" ADD COLUMN "workType" TEXT NOT NULL DEFAULT 'Service';
ALTER TABLE "Request" ADD COLUMN "details" TEXT;
ALTER TABLE "Request" ADD COLUMN "preferredDate" TEXT;
