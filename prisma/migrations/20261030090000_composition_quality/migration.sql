ALTER TABLE "ContentGeneration" ADD COLUMN "refinementSourceId" UUID,
 ADD COLUMN "requestSnapshot" JSONB NOT NULL DEFAULT '{}',
 ADD COLUMN "qualityReview" JSONB;
ALTER TABLE "ContentGeneration" ADD CONSTRAINT "ContentGeneration_refinementSourceId_fkey" FOREIGN KEY ("refinementSourceId") REFERENCES "ContentItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "ContentGeneration_refinementSourceId_idx" ON "ContentGeneration"("refinementSourceId");
