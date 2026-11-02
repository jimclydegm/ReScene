type Report = {
  walls: number;
  expectedWalls: number;
  coverage: number;
  projectionError: number;
};
export function usableEnvironment(report: Report) {
  return (
    report.walls >= report.expectedWalls &&
    report.coverage >= 0.8 &&
    report.projectionError <= 0.08
  );
}
/** An empty plate is an alternate observation, not evidence that it must be better. */
export function chooseEnvironmentDepth<T extends { report: Report }>(
  original: T | null,
  clean: T | null,
) {
  if (!original) {
    if (clean) return { built: clean, source: "clean" as const };
    throw new Error("ENVIRONMENT_STRUCTURE_INCOMPLETE");
  }
  if (!clean) return { built: original, source: "original" as const };
  const sourceValid = usableEnvironment(original.report),
    cleanValid = usableEnvironment(clean.report);
  if (sourceValid !== cleanValid)
    return sourceValid
      ? { built: original, source: "original" as const }
      : { built: clean, source: "clean" as const };
  const score = (r: Report) =>
    Math.max(0, r.expectedWalls - r.walls) * 4 +
    (1 - r.coverage) * 3 +
    r.projectionError * 4;
  return score(original.report) + 0.03 < score(clean.report)
    ? { built: original, source: "original" as const }
    : { built: clean, source: "clean" as const };
}
