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
