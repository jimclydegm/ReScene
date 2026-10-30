-- CreateTable
CREATE TABLE "ContentItem" (
    "id" UUID NOT NULL,
    "ownerId" UUID,
    "assetId" UUID,
    "sampleKey" VARCHAR(100),
    "title" VARCHAR(160) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "publicPath" VARCHAR(300),
    "provenance" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archivedAt" TIMESTAMPTZ(3),

    CONSTRAINT "ContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionDraft" (
    "id" UUID NOT NULL,
    "sceneId" UUID NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "prompt" VARCHAR(2000) NOT NULL DEFAULT '',
    "templateKey" VARCHAR(80) NOT NULL DEFAULT 'studio',
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "aspectRatio" VARCHAR(16) NOT NULL DEFAULT '4:3',
    "projectTitle" VARCHAR(160) NOT NULL DEFAULT 'My product scene',
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "CompositionDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompositionReference" (
    "draftId" UUID NOT NULL,
    "contentItemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "CompositionReference_pkey" PRIMARY KEY ("draftId","contentItemId")
);

-- CreateTable
CREATE TABLE "ContentGeneration" (
    "id" UUID NOT NULL,
    "draftId" UUID NOT NULL,
    "runId" UUID NOT NULL,
    "outputItemId" UUID,
    "prompt" VARCHAR(2000) NOT NULL,
    "templateKey" VARCHAR(80) NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "aspectRatio" VARCHAR(16) NOT NULL,
    "modelId" VARCHAR(100) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentGeneration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationReference" (
    "generationId" UUID NOT NULL,
    "contentItemId" UUID NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "GenerationReference_pkey" PRIMARY KEY ("generationId","contentItemId")
);

-- CreateTable
CREATE TABLE "ContentAdoption" (
    "sceneId" UUID NOT NULL,
    "contentItemId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentAdoption_pkey" PRIMARY KEY ("sceneId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_sampleKey_key" ON "ContentItem"("sampleKey");

-- CreateIndex
CREATE INDEX "ContentItem_ownerId_archivedAt_createdAt_idx" ON "ContentItem"("ownerId", "archivedAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContentItem_ownerId_assetId_key" ON "ContentItem"("ownerId", "assetId");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionDraft_sceneId_key" ON "CompositionDraft"("sceneId");

-- CreateIndex
CREATE INDEX "CompositionReference_contentItemId_idx" ON "CompositionReference"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "CompositionReference_draftId_position_key" ON "CompositionReference"("draftId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "ContentGeneration_runId_key" ON "ContentGeneration"("runId");

-- CreateIndex
CREATE INDEX "GenerationReference_contentItemId_idx" ON "GenerationReference"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationReference_generationId_position_key" ON "GenerationReference"("generationId", "position");

-- CreateIndex
CREATE INDEX "ContentAdoption_contentItemId_idx" ON "ContentAdoption"("contentItemId");

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "AppUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionDraft" ADD CONSTRAINT "CompositionDraft_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionReference" ADD CONSTRAINT "CompositionReference_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CompositionDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompositionReference" ADD CONSTRAINT "CompositionReference_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGeneration" ADD CONSTRAINT "ContentGeneration_draftId_fkey" FOREIGN KEY ("draftId") REFERENCES "CompositionDraft"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGeneration" ADD CONSTRAINT "ContentGeneration_runId_fkey" FOREIGN KEY ("runId") REFERENCES "GenerationRun"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentGeneration" ADD CONSTRAINT "ContentGeneration_outputItemId_fkey" FOREIGN KEY ("outputItemId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationReference" ADD CONSTRAINT "GenerationReference_generationId_fkey" FOREIGN KEY ("generationId") REFERENCES "ContentGeneration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationReference" ADD CONSTRAINT "GenerationReference_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAdoption" ADD CONSTRAINT "ContentAdoption_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContentAdoption" ADD CONSTRAINT "ContentAdoption_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Backfill immutable identities for existing owned references and generations.
INSERT INTO "ContentItem" (id,"ownerId","assetId",title,category,kind,provenance,"createdAt")
SELECT a.id,s."ownerId",a.id,left(coalesce(a.provenance->>'label','Saved image'),160),'Uncategorized',CASE WHEN a.kind='SOURCE_IMAGE' THEN 'GENERATED' ELSE 'REFERENCE' END,a.provenance,a."createdAt"
FROM "Asset" a JOIN "Scene" s ON s.id=a."sceneId"
WHERE a.status='READY' AND (a.kind='PRODUCT_IMAGE' OR (a.kind='SOURCE_IMAGE' AND a.provenance->>'source'='muse-scene-composition'));
INSERT INTO "CompositionDraft" (id,"sceneId","updatedAt") SELECT gen_random_uuid(),id,now() FROM "Scene" WHERE settings->>'creative'='true';
INSERT INTO "ContentGeneration" (id,"draftId","runId","outputItemId",prompt,"templateKey","aspectRatio","modelId","createdAt")
SELECT gen_random_uuid(),d.id,r.id,(SELECT a.id FROM "Asset" a WHERE a.provenance->>'runId'=r.id::text AND a.provenance->>'source'='muse-scene-composition' LIMIT 1),left(coalesce(r.input->>'prompt',''),2000),coalesce(r.input->>'template','studio'),coalesce(r.input->>'aspect','4:3'),'muse-image-1.0',r."createdAt" FROM "GenerationRun" r JOIN "CompositionDraft" d ON d."sceneId"=r."sceneId" WHERE r.kind='COMPOSE_IMAGE';
INSERT INTO "GenerationReference" ("generationId","contentItemId",position)
SELECT g.id,c.id,(e.ordinality-1)::int FROM "ContentGeneration" g JOIN "GenerationRun" r ON r.id=g."runId", jsonb_array_elements_text(r.input->'referenceIds') WITH ORDINALITY e(value,ordinality) JOIN "ContentItem" c ON c.id=e.value::uuid;
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'table:v1','Oak dining table','Furniture','SAMPLE','/samples/table.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'chair:v1','Sage lounge chair','Furniture','SAMPLE','/samples/chair.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'drawers:v1','Oak drawer chest','Furniture','SAMPLE','/samples/drawers.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'lamp:v1','Black floor lamp','Lighting','SAMPLE','/samples/lamp.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'vase:v1','Ceramic vase','Decor','SAMPLE','/samples/vase.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'shoes:v1','White sneakers','Fashion','SAMPLE','/samples/shoes.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'cabinet:v1','Walnut cabinet','Furniture','SAMPLE','/samples/cabinet.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'mannequin-shirt:v1','T-shirt on mannequin','Fashion','SAMPLE','/samples/mannequin-shirt.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'alarm-clock:v1','Digital alarm clock','Electronics','SAMPLE','/samples/alarm-clock.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'watch:v1','Leather-strap watch','Accessories','SAMPLE','/samples/watch.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'sofa:v1','Cream fabric sofa','Furniture','SAMPLE','/samples/sofa.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
INSERT INTO "ContentItem" (id,"sampleKey",title,category,kind,"publicPath",provenance) VALUES (gen_random_uuid(),'plant:v1','Potted plant','Decor','SAMPLE','/samples/plant.webp','{"source":"meta-generated-sample","model":"muse-image-1.0","version":1}');
ALTER TABLE "ContentItem" ADD CONSTRAINT "ContentItem_visibility" CHECK (("ownerId" IS NOT NULL AND "assetId" IS NOT NULL AND "publicPath" IS NULL) OR ("ownerId" IS NULL AND "assetId" IS NULL AND "sampleKey" IS NOT NULL AND "publicPath" LIKE '/samples/%'));
ALTER TABLE "CompositionReference" ADD CONSTRAINT "CompositionReference_position" CHECK (position BETWEEN 0 AND 5);
ALTER TABLE "GenerationReference" ADD CONSTRAINT "GenerationReference_position" CHECK (position BETWEEN 0 AND 5);
