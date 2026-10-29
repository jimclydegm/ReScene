import "server-only";
import OpenAI from "openai";
import { requiredEnv } from "@/lib/env";

let client: OpenAI | undefined;

// OpenAI-compatible SDK, connected exclusively to Meta Model API.
export function getMetaClient(): OpenAI {
  client ??= new OpenAI({
    apiKey: requiredEnv("MODEL_API_KEY"),
    baseURL: process.env.META_API_BASE_URL ?? "https://api.meta.ai/v1",
    maxRetries: 2, timeout: 60_000
  });
  return client;
}

export const metaModels = {
  analysis: () => process.env.META_ANALYSIS_MODEL ?? "muse-spark-1.3",
  segmentation: () => process.env.META_SEGMENTATION_MODEL ?? "sam-3.1"
};
