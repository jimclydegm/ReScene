/** Curated, muted palette that reads well on product surfaces in both themes. */
export const PRESET_COLORS = [
  "#f3efe8",
  "#d9d2c4",
  "#a89f91",
  "#6f7d74",
  "#45524b",
  "#8a5f4a",
  "#b45f41",
  "#44507a",
] as const;

/** Normalize user-typed hex to lowercase #rrggbb, or null when invalid. */
export function normalizeHexColor(input: string): string | null {
  const raw = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw.split("").map((c) => c + c).join("").toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
  return null;
}
