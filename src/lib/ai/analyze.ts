import "server-only";
import { z } from "zod";
import { getMetaClient, metaModels } from "./meta";
import { analysisSchema, validateAnalysis, type ImageSize } from "./contracts";
import {
  analysisSystemPrompt,
  analysisUserPrompt,
  defaultAnalysisOptions,
  type AnalysisOptions,
} from "./controls";
import { backgroundObservationSchema } from "@/lib/scene/background";
import { strictResponseFormat } from "./structured-output";
import { ProviderResultError } from "./provider-failure";

export const analysisPromptVersion = "scene-observations-v9";
export const analysisResponseSchema = analysisSchema.extend({
  background: backgroundObservationSchema,
  objects: analysisSchema.shape.objects.element
    .extend({
      surfaceRole: z.enum(["background", "object"]),
      parentCandidateId: z
        .string()
        .regex(/^candidate-(?:[1-9]|10)$/)
        .nullable(),
      supportedByCandidateId: z
        .string()
        .regex(/^candidate-(?:[1-9]|10)$/)
        .nullable(),
    })
    .strict()
    .array()
    .max(10),
});
type Receipt = {
  id: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
};
export type AnalysisEvents = {
  onRequest?: () => Promise<void>;
  onResponse?: (response: Receipt) => Promise<void>;
};
export async function analyzePhoto(
  imageUrl: string,
  size: ImageSize,
  options: AnalysisOptions = defaultAnalysisOptions,
  events: AnalysisEvents = {},
) {
  const started = Date.now(),
    client = getMetaClient();
  const request = {
    model: metaModels.analysis(),
    max_completion_tokens: 4096,
    messages: [
      { role: "system" as const, content: analysisSystemPrompt },
      {
        role: "user" as const,
        content: [
          { type: "text" as const, text: analysisUserPrompt(size, options) },
          { type: "image_url" as const, image_url: { url: imageUrl } },
        ],
      },
    ],
    response_format: strictResponseFormat(
      "scene_analysis",
      analysisResponseSchema,
    ),
  };
  await events.onRequest?.();
  const response = await client.chat.completions.create(request, {
    maxRetries: 0,
  });
  // Persist the received response before parsing/validation. A bad model result
  // is distinct from losing the connection before any response was received.
  await events.onResponse?.(response);
  const choice = response.choices[0];
  if (
    choice?.finish_reason !== "stop" ||
    !choice.message.content ||
    choice.message.refusal
  )
    throw new ProviderResultError(
      "Analysis did not return a complete structured result",
    );
  let analysis;
  try {
    analysis = validateAnalysis(JSON.parse(choice.message.content), size);
  } catch (error) {
    throw new ProviderResultError(
      error instanceof Error ? error.message : "Invalid analysis response",
    );
  }
  return {
    analysis,
    model: response.model,
    requestId: response.id,
    promptVersion: analysisPromptVersion,
    durationMs: Date.now() - started,
    usage: response.usage,
    raw: response,
  };
}
