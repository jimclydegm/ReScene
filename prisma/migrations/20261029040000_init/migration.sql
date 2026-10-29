-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('DRAFT', 'ANALYZING', 'REVIEW', 'RECONSTRUCTING', 'READY', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('UPLOAD_STAGING', 'SOURCE_IMAGE', 'NORMALIZED_IMAGE', 'MASK', 'CUTOUT', 'MODEL_GLB', 'PRODUCT_IMAGE', 'POSTER', 'PROVIDER_RESPONSE', 'SCENE_MANIFEST');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('PENDING', 'VALIDATING', 'READY', 'REJECTED', 'DELETING', 'DELETED');

-- CreateEnum
CREATE TYPE "ObjectStatus" AS ENUM ('DETECTED', 'CONFIRMED', 'RECONSTRUCTING', 'READY', 'FAILED', 'EXCLUDED');

-- CreateEnum
CREATE TYPE "Representation" AS ENUM ('MESH', 'CUTOUT', 'PROXY');

-- CreateEnum
CREATE TYPE "RunKind" AS ENUM ('ANALYZE', 'SEGMENT_OBJECT', 'RECONSTRUCT', 'RECONSTRUCT_OBJECT', 'IMAGE_EDIT');

-- CreateEnum
CREATE TYPE "RunStatus" AS ENUM ('QUEUED', 'RUNNING', 'WAITING', 'CANCEL_REQUESTED', 'SUCCEEDED', 'PARTIAL', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "StepStatus" AS ENUM ('PENDING', 'RUNNING', 'WAITING', 'SUBMISSION_UNCERTAIN', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('INTERNAL', 'META', 'FAL');

-- CreateTable
CREATE TABLE "AppUser" (
    "id" UUID NOT NULL,
    "authSubject" VARCHAR(255) NOT NULL,
    "displayName" VARCHAR(120),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "AppUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "description" VARCHAR(2000),
    "status" "SceneStatus" NOT NULL DEFAULT 'DRAFT',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "sourceAssetId" UUID,
    "normalizedAssetId" UUID,
    "posterAssetId" UUID,
    "camera" JSONB NOT NULL DEFAULT '{}',
    "stage" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "lastErrorCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "kind" "AssetKind" NOT NULL,
    "status" "AssetStatus" NOT NULL DEFAULT 'PENDING',
    "bucket" VARCHAR(128) NOT NULL,
    "storageKey" VARCHAR(1024) NOT NULL,
    "mimeType" VARCHAR(100) NOT NULL,
    "byteSize" INTEGER,
    "sha256" CHAR(64),
    "width" INTEGER,
    "height" INTEGER,
    "derivedFromId" UUID,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "uploadExpiresAt" TIMESTAMPTZ(3),
    "readyAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ(3),

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" VARCHAR(4000),
    "brand" VARCHAR(120),
    "sku" VARCHAR(120),
    "price" DECIMAL(12,2),
    "currency" CHAR(3),
    "productUrl" VARCHAR(2048),
    "imageAssetId" UUID,
    "modelAssetId" UUID,
    "attributes" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SceneObject" (
    "id" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "originRunId" UUID,
    "sourceOrdinal" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "status" "ObjectStatus" NOT NULL DEFAULT 'DETECTED',
    "representation" "Representation" NOT NULL DEFAULT 'PROXY',
    "segmentationConcept" VARCHAR(160),
    "confidence" DOUBLE PRECISION,
    "imageBounds" JSONB,
    "maskAssetId" UUID,
    "cutoutAssetId" UUID,
    "modelAssetId" UUID,
    "productId" UUID,
    "positionX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "positionZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationZ" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rotationW" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scaleX" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scaleY" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "scaleZ" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "localBounds" JSONB,
    "initialTransform" JSONB,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "lastErrorCode" VARCHAR(80),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "SceneObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationRun" (
    "id" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "kind" "RunKind" NOT NULL,
    "status" "RunStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" VARCHAR(128) NOT NULL,
    "workflowRunId" VARCHAR(255),
    "inputRevision" INTEGER NOT NULL,
    "input" JSONB NOT NULL DEFAULT '{}',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" VARCHAR(80),
    "reservedCostUsd" DECIMAL(10,4) NOT NULL DEFAULT 0,
    "actualCostUsd" DECIMAL(10,4),
    "errorCode" VARCHAR(80),
    "errorMessage" VARCHAR(1000),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GenerationRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationStep" (
    "id" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "key" VARCHAR(160) NOT NULL,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" "StepStatus" NOT NULL DEFAULT 'PENDING',
    "provider" "Provider" NOT NULL DEFAULT 'INTERNAL',
    "modelId" VARCHAR(255),
    "providerRequestId" VARCHAR(255),
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "responseAssetId" UUID,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "imageCount" INTEGER,
    "costUsd" DECIMAL(10,4),
    "errorCode" VARCHAR(80),
    "errorMessage" VARCHAR(1000),
    "startedAt" TIMESTAMPTZ(3),
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "GenerationStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScenePublication" (
    "id" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "slug" VARCHAR(48) NOT NULL,
    "revision" INTEGER NOT NULL,
    "manifestAssetId" UUID NOT NULL,
    "assetIds" JSONB NOT NULL,
    "publishedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ScenePublication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppUser_authSubject_key" ON "AppUser"("authSubject");

-- CreateIndex
CREATE INDEX "Scene_ownerId_archivedAt_updatedAt_idx" ON "Scene"("ownerId", "archivedAt", "updatedAt");

-- CreateIndex
CREATE INDEX "Scene_status_updatedAt_idx" ON "Scene"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Asset_sceneId_kind_status_idx" ON "Asset"("sceneId", "kind", "status");

-- CreateIndex
CREATE INDEX "Asset_derivedFromId_idx" ON "Asset"("derivedFromId");

-- CreateIndex
CREATE INDEX "Asset_status_uploadExpiresAt_idx" ON "Asset"("status", "uploadExpiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_bucket_storageKey_key" ON "Asset"("bucket", "storageKey");

-- CreateIndex
CREATE INDEX "Product_sceneId_createdAt_idx" ON "Product"("sceneId", "createdAt");

-- CreateIndex
CREATE INDEX "SceneObject_sceneId_status_sortOrder_idx" ON "SceneObject"("sceneId", "status", "sortOrder");

-- CreateIndex
CREATE INDEX "SceneObject_productId_idx" ON "SceneObject"("productId");

-- CreateIndex
CREATE INDEX "SceneObject_originRunId_idx" ON "SceneObject"("originRunId");

-- CreateIndex
CREATE UNIQUE INDEX "SceneObject_sceneId_sourceOrdinal_key" ON "SceneObject"("sceneId", "sourceOrdinal");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRun_workflowRunId_key" ON "GenerationRun"("workflowRunId");

-- CreateIndex
CREATE INDEX "GenerationRun_sceneId_createdAt_idx" ON "GenerationRun"("sceneId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationRun_status_expiresAt_idx" ON "GenerationRun"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationRun_sceneId_idempotencyKey_key" ON "GenerationRun"("sceneId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "GenerationStep_runId_key_status_idx" ON "GenerationStep"("runId", "key", "status");

-- CreateIndex
CREATE INDEX "GenerationStep_provider_providerRequestId_idx" ON "GenerationStep"("provider", "providerRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationStep_runId_key_attempt_key" ON "GenerationStep"("runId", "key", "attempt");

-- CreateIndex
CREATE UNIQUE INDEX "ScenePublication_slug_key" ON "ScenePublication"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "ScenePublication_manifestAssetId_key" ON "ScenePublication"("manifestAssetId");

-- CreateIndex
CREATE INDEX "ScenePublication_sceneId_publishedAt_idx" ON "ScenePublication"("sceneId", "publishedAt");

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_normalizedAssetId_fkey" FOREIGN KEY ("normalizedAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_posterAssetId_fkey" FOREIGN KEY ("posterAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_derivedFromId_fkey" FOREIGN KEY ("derivedFromId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_imageAssetId_fkey" FOREIGN KEY ("imageAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_modelAssetId_fkey" FOREIGN KEY ("modelAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneObject" ADD CONSTRAINT "SceneObject_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneObject" ADD CONSTRAINT "SceneObject_originRunId_fkey" FOREIGN KEY ("originRunId") REFERENCES "GenerationRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneObject" ADD CONSTRAINT "SceneObject_maskAssetId_fkey" FOREIGN KEY ("maskAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneObject" ADD CONSTRAINT "SceneObject_cutoutAssetId_fkey" FOREIGN KEY ("cutoutAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneObject" ADD CONSTRAINT "SceneObject_modelAssetId_fkey" FOREIGN KEY ("modelAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SceneObject" ADD CONSTRAINT "SceneObject_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationStep" ADD CONSTRAINT "GenerationStep_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GenerationRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationStep" ADD CONSTRAINT "GenerationStep_responseAssetId_fkey" FOREIGN KEY ("responseAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenePublication" ADD CONSTRAINT "ScenePublication_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScenePublication" ADD CONSTRAINT "ScenePublication_manifestAssetId_fkey" FOREIGN KEY ("manifestAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Proposed additions to the initial Prisma-generated migration.
-- This file is NOT applied automatically and has not been run against a database.
-- Review and append to migration.sql in Phase 1; never run it against neon_auth.

CREATE UNIQUE INDEX "GenerationRun_one_active_scene"
ON "GenerationRun" ("sceneId")
WHERE "status" IN ('QUEUED', 'RUNNING', 'WAITING', 'CANCEL_REQUESTED');

ALTER TABLE "Scene" ADD CONSTRAINT "Scene_revision_nonnegative"
CHECK ("revision" >= 0);

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_valid_dimensions_and_bytes"
CHECK (("byteSize" IS NULL OR "byteSize" >= 0)
  AND ("width" IS NULL OR "width" > 0)
  AND ("height" IS NULL OR "height" > 0));

ALTER TABLE "Asset" ADD CONSTRAINT "Asset_ready_metadata"
CHECK ("status" <> 'READY'
  OR ("byteSize" IS NOT NULL AND "sha256" IS NOT NULL AND "readyAt" IS NOT NULL));

ALTER TABLE "Product" ADD CONSTRAINT "Product_price_currency"
CHECK (("price" IS NULL AND "currency" IS NULL)
  OR ("price" IS NOT NULL AND "price" >= 0 AND "currency" IS NOT NULL
    AND "currency" ~ '^[A-Z]{3}$'));

ALTER TABLE "SceneObject" ADD CONSTRAINT "SceneObject_valid_transform"
CHECK ("sourceOrdinal" >= 0
  AND "scaleX" BETWEEN 0.01 AND 100
  AND "scaleY" BETWEEN 0.01 AND 100
  AND "scaleZ" BETWEEN 0.01 AND 100
  AND abs("positionX") <= 1000 AND abs("positionY") <= 1000 AND abs("positionZ") <= 1000
  AND ("rotationX" * "rotationX" + "rotationY" * "rotationY"
    + "rotationZ" * "rotationZ" + "rotationW" * "rotationW") BETWEEN 0.998 AND 1.002
  AND ("confidence" IS NULL OR "confidence" BETWEEN 0 AND 1));

ALTER TABLE "GenerationRun" ADD CONSTRAINT "GenerationRun_valid_limits"
CHECK ("inputRevision" >= 0 AND "progress" BETWEEN 0 AND 100
  AND "reservedCostUsd" >= 0 AND ("actualCostUsd" IS NULL OR "actualCostUsd" >= 0)
  AND "expiresAt" > "createdAt");

ALTER TABLE "GenerationStep" ADD CONSTRAINT "GenerationStep_valid_usage"
CHECK ("attempt" >= 1
  AND ("inputTokens" IS NULL OR "inputTokens" >= 0)
  AND ("outputTokens" IS NULL OR "outputTokens" >= 0)
  AND ("imageCount" IS NULL OR "imageCount" >= 0)
  AND ("costUsd" IS NULL OR "costUsd" >= 0));

ALTER TABLE "ScenePublication" ADD CONSTRAINT "ScenePublication_valid_snapshot"
CHECK ("revision" >= 0 AND jsonb_typeof("assetIds") = 'array'
  AND "slug" ~ '^[A-Za-z0-9_-]{32}$');
