import type { EnvironmentObservation } from "./environment-plan";
// Older observations sometimes label a textured finish as plain paint. An
// explicit uniform/smooth description wins; natural substrate detail is retained.
export function environmentUsesTexture(
  surface: EnvironmentObservation["surfaces"][number],
) {
  if (surface.finish === "textured") return true;
  if (
    /\b(uniform|smooth|solid|flat color|untextured)\b/i.test(surface.material)
  )
    return false;
  return /\b(plaster|limewash|stucco|concrete|grain|weave|brick|stone|marble)\b/i.test(
    surface.material,
  );
}
