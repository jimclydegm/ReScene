-- Saved background variants. Active background stays in Scene.stage/settings for renderer/publication compatibility.
CREATE TABLE "SceneBackground" (
  "id" UUID NOT NULL,
  "sceneId" UUID NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "textureAssetId" UUID,
  "geometry" JSONB NOT NULL DEFAULT '{}',
  "prompt" VARCHAR(2000),
  "provenance" JSONB NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "deletedAt" TIMESTAMPTZ(3),
  CONSTRAINT "SceneBackground_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SceneBackground" ADD CONSTRAINT "SceneBackground_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SceneBackground" ADD CONSTRAINT "SceneBackground_textureAssetId_fkey" FOREIGN KEY ("textureAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SceneBackground_sceneId_createdAt_idx" ON "SceneBackground"("sceneId", "createdAt");
CREATE INDEX "SceneBackground_sceneId_deletedAt_idx" ON "SceneBackground"("sceneId", "deletedAt");
