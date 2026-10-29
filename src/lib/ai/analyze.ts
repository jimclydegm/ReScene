import "server-only";
import { z } from "zod";
import { getMetaClient, metaModels } from "./meta";
import { analysisSchema, validateAnalysis, type ImageSize } from "./contracts";
import { analysisSystemPrompt, analysisUserPrompt, defaultAnalysisOptions, type AnalysisOptions } from "./controls";

export const analysisPromptVersion = "scene-assemblies-v4";
export async function analyzePhoto(imageUrl: string, size: ImageSize, options: AnalysisOptions = defaultAnalysisOptions) {
  const started = Date.now();
  const response = await getMetaClient().chat.completions.create({
    model: metaModels.analysis(), max_completion_tokens: 4096,
    messages: [
      { role: "system", content: analysisSystemPrompt },
      { role: "user", content: [
        { type: "text", text: analysisUserPrompt(size, options) },
        { type: "image_url", image_url: { url: imageUrl } }
      ] }
    ],
    response_format: { type: "json_schema", json_schema: {
      name: "scene_analysis", strict: true, schema: z.toJSONSchema(analysisSchema.extend({objects: analysisSchema.shape.objects.element.extend({parentCandidateId: z.string().regex(/^candidate-(?:[1-9]|10)$/).nullable()}).strict().array().max(10)}))
    } }
  }, { maxRetries: 0 });
  const choice = response.choices[0];
  if (choice?.finish_reason !== "stop" || !choice.message.content || choice.message.refusal) throw new Error("Analysis did not return a complete structured result");
  return {
    analysis: validateAnalysis(JSON.parse(choice.message.content), size),
    model: response.model, requestId: response.id, promptVersion: analysisPromptVersion,
    durationMs: Date.now() - started, usage: response.usage, raw: response
  };
}
