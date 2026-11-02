-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "geofenceMode" TEXT NOT NULL DEFAULT 'flag';

-- CreateTable
CREATE TABLE "GeoCache" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "query" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lng" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "GeoCache_query_key" ON "GeoCache"("query");
