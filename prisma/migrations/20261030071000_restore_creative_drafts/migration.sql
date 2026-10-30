-- Restore the most recent saved settings and ordered references for legacy workspaces.
UPDATE "CompositionDraft" d SET prompt=coalesce(r.input->>'prompt',''),"templateKey"=coalesce(r.input->>'template','studio'),"aspectRatio"=coalesce(r.input->>'aspect','4:3'),"projectTitle"=coalesce(r.input->>'projectTitle','My product scene')
FROM (SELECT DISTINCT ON ("sceneId") * FROM "GenerationRun" WHERE kind='COMPOSE_IMAGE' ORDER BY "sceneId","createdAt" DESC) r WHERE r."sceneId"=d."sceneId" AND d.revision=0;
INSERT INTO "CompositionReference" ("draftId","contentItemId",position)
SELECT d.id,c.id,(e.ordinality-1)::int FROM "CompositionDraft" d JOIN (SELECT DISTINCT ON ("sceneId") * FROM "GenerationRun" WHERE kind='COMPOSE_IMAGE' ORDER BY "sceneId","createdAt" DESC) r ON r."sceneId"=d."sceneId",jsonb_array_elements_text(r.input->'referenceIds') WITH ORDINALITY e(value,ordinality) JOIN "ContentItem" c ON c.id=e.value::uuid WHERE d.revision=0 ON CONFLICT DO NOTHING;

UPDATE "ContentItem" SET "publicPath"=replace("publicPath",'/samples/','/samples/v1/') WHERE "ownerId" IS NULL AND "sampleKey" LIKE '%:v1';
