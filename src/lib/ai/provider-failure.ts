export type ProviderPhase = "preparing" | "requesting" | "responded";
export class ProviderResultError extends Error {
  constructor(
    message: string,
    public code:
      | "ANALYSIS_RESULT_INVALID"
      | "ANALYSIS_OUTPUT_LIMIT" = "ANALYSIS_RESULT_INVALID",
  ) {
    super(message);
    this.name = "ProviderResultError";
  }
}
export function classifyAnalysisFailure(error: unknown, phase: ProviderPhase) {
  const value =
      error && typeof error === "object"
        ? (error as Record<string, unknown>)
        : {},
    http = Number(value.status);
  let errorCode: string,
    status: "FAILED" | "SUBMISSION_UNCERTAIN" = "FAILED";
  if (phase === "preparing")
    errorCode =
      value.name === "InvalidProviderSchemaError"
        ? "ANALYSIS_SCHEMA_INVALID"
        : "ANALYSIS_PREPARATION_FAILED";
  else if (phase === "responded")
    errorCode =
      value.name === "ProviderResultError"
        ? value.code === "ANALYSIS_OUTPUT_LIMIT"
          ? "ANALYSIS_OUTPUT_LIMIT"
          : "ANALYSIS_RESULT_INVALID"
        : "ANALYSIS_PROCESSING_FAILED";
  else if (http >= 400 && http <= 599 && http !== 408)
    errorCode = `META_HTTP_${http}`;
  else {
    errorCode = "SUBMISSION_UNCERTAIN";
    status = "SUBMISSION_UNCERTAIN";
  }
  const message =
    error instanceof Error ? error.message : "Unknown analysis failure";
  return {
    status,
    errorCode,
    errorMessage: message
      .replace(
        /data:[^\s"']+|https?:\/\/[^\s"']+|[A-Za-z0-9+/=_-]{100,}/g,
        "[redacted]",
      )
      .slice(0, 900),
  };
}
export function analysisFailureMessage(code: string) {
  if (code === "ANALYSIS_OUTPUT_LIMIT")
    return "Meta reached the analysis response limit before finishing. Your photo is saved. No automatic retry was submitted.";
  if (code === "META_HTTP_400" || code === "ANALYSIS_SCHEMA_INVALID")
    return "The analysis request was rejected because its format was invalid. Your photo is saved. Please try analysis again.";
  if (code === "META_HTTP_401" || code === "META_HTTP_403")
    return "Meta could not authorize the analysis request. Your photo is saved. Check the API connection before trying again.";
  if (code === "META_HTTP_429")
    return "Meta's request limit was reached. Your photo is saved. Try analysis again later.";
  if (code.startsWith("META_HTTP_"))
    return "Meta could not complete the analysis request. Your photo is saved. You can try again when ready.";
  if (
    code === "ANALYSIS_RESULT_INVALID" ||
    code === "ANALYSIS_PROCESSING_FAILED"
  )
    return "Meta returned a response, but analysis could not finish. Your photo is saved. No new request was submitted automatically.";
  return "ReScene could not prepare the analysis request. Your photo is saved. Please try again.";
}
