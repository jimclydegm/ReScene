CREATE TABLE "VoiceAttempt" (
  "id" UUID NOT NULL,
  "actorHash" VARCHAR(64) NOT NULL,
  "networkHash" VARCHAR(64) NOT NULL,
  "requestKey" UUID NOT NULL,
  "purpose" VARCHAR(24) NOT NULL,
  "inputHash" VARCHAR(64) NOT NULL,
  "status" "StepStatus" NOT NULL DEFAULT 'RUNNING',
  "model" VARCHAR(80) NOT NULL,
  "durationMs" INTEGER NOT NULL,
  "transcript" VARCHAR(4000),
  "errorCode" VARCHAR(80),
  "commandStatus" "StepStatus",
  "commandInputHash" VARCHAR(64),
  "commandPlan" JSONB,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "VoiceAttempt_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VoiceAttempt_duration_check" CHECK ("durationMs" BETWEEN 0 AND 35000)
);
CREATE UNIQUE INDEX "VoiceAttempt_actorHash_requestKey_key" ON "VoiceAttempt"("actorHash", "requestKey");
CREATE INDEX "VoiceAttempt_actorHash_createdAt_idx" ON "VoiceAttempt"("actorHash", "createdAt");
CREATE INDEX "VoiceAttempt_networkHash_createdAt_idx" ON "VoiceAttempt"("networkHash", "createdAt");
CREATE INDEX "VoiceAttempt_expiresAt_idx" ON "VoiceAttempt"("expiresAt");
