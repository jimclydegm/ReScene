CREATE TYPE "CatalogRole" AS ENUM ('SOURCE', 'INSTANCE', 'TEMPLATE');
CREATE TYPE "CatalogStatus" AS ENUM ('DRAFT', 'READY', 'ARCHIVED');
ALTER TABLE "Product"
  ADD COLUMN "catalogRole" "CatalogRole",
  ADD COLUMN "catalogStatus" "CatalogStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "catalogKey" VARCHAR(80),
  ADD COLUMN "sourceObjectKey" VARCHAR(80),
  ADD COLUMN "sourceProductId" UUID,
  ADD COLUMN "inferredDetails" JSONB NOT NULL DEFAULT '{}';
CREATE UNIQUE INDEX "Product_catalogKey_key" ON "Product"("catalogKey");
CREATE UNIQUE INDEX "Product_sourceObjectKey_key" ON "Product"("sourceObjectKey");
CREATE INDEX "Product_catalogRole_catalogStatus_sceneId_idx" ON "Product"("catalogRole", "catalogStatus", "sceneId");
CREATE INDEX "Product_sourceProductId_idx" ON "Product"("sourceProductId");
ALTER TABLE "Product" ADD CONSTRAINT "Product_sourceProductId_fkey" FOREIGN KEY ("sourceProductId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ShoppingStylistRequest" (
  "id" UUID NOT NULL,
  "actorHash" VARCHAR(64) NOT NULL,
  "networkHash" VARCHAR(64) NOT NULL,
  "requestKey" UUID NOT NULL,
  "inputHash" CHAR(64) NOT NULL,
  "catalogRevision" CHAR(64) NOT NULL,
  "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
  "phase" VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
  "input" JSONB NOT NULL,
  "intent" JSONB,
  "result" JSONB,
  "usage" JSONB NOT NULL DEFAULT '{}',
  "errorCode" VARCHAR(80),
  "errorMessage" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "ShoppingStylistRequest_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ShoppingStylistRequest_actorHash_requestKey_key" ON "ShoppingStylistRequest"("actorHash", "requestKey");
CREATE INDEX "ShoppingStylistRequest_actorHash_createdAt_idx" ON "ShoppingStylistRequest"("actorHash", "createdAt");
CREATE INDEX "ShoppingStylistRequest_networkHash_createdAt_idx" ON "ShoppingStylistRequest"("networkHash", "createdAt");
CREATE INDEX "ShoppingStylistRequest_status_expiresAt_idx" ON "ShoppingStylistRequest"("status", "expiresAt");
ALTER TABLE "ShoppingStylistRequest" ADD CONSTRAINT "ShoppingStylistRequest_expiry_check" CHECK ("expiresAt" > "createdAt");
