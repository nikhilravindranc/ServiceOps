-- CreateTable
CREATE TABLE "WorkspaceEntity" (
    "orgId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "json" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "updatedAt" DATETIME NOT NULL,

    PRIMARY KEY ("orgId", "kind", "key"),
    CONSTRAINT "WorkspaceEntity_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
