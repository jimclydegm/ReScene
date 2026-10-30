import { z } from "zod";

export class InvalidProviderSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidProviderSchemaError";
  }
}
// Catch unsupported strict schemas locally, before sending a paid request.
// Meta requires every object property to be required, including nullable fields.
export function assertStrictSchema(schema: Record<string, unknown>) {
  if (schema.type !== "object")
    throw new InvalidProviderSchemaError(
      "Structured output must have an object root.",
    );
  function visit(node: unknown, path: string) {
    if (!node || typeof node !== "object" || Array.isArray(node)) return;
    const s = node as Record<string, unknown>;
    if (s.oneOf || s.allOf)
      throw new InvalidProviderSchemaError(
        `${path}: oneOf/allOf are unsupported.`,
      );
    if (s.type === "object" || s.properties) {
      const properties = (s.properties ?? {}) as Record<string, unknown>,
        keys = Object.keys(properties),
        required = s.required;
      if (
        s.additionalProperties !== false ||
        !Array.isArray(required) ||
        keys.length !== required.length ||
        keys.some((k) => !required.includes(k))
      )
        throw new InvalidProviderSchemaError(
          `${path}: all properties must be required and additionalProperties must be false.`,
        );
      for (const [key, value] of Object.entries(properties))
        visit(value, `${path}.${key}`);
    }
    if (s.items) visit(s.items, `${path}[]`);
    for (const key of ["anyOf", "prefixItems"])
      if (Array.isArray(s[key]))
        for (const [i, value] of s[key].entries())
          visit(value, `${path}.${key}[${i}]`);
    for (const key of ["$defs", "definitions"])
      if (s[key] && typeof s[key] === "object")
        for (const [name, value] of Object.entries(s[key]))
          visit(value, `${path}.${key}.${name}`);
  }
  visit(schema, "response");
}
export function strictResponseFormat(name: string, schema: z.ZodType) {
  const json = z.toJSONSchema(schema);
  assertStrictSchema(json);
  return {
    type: "json_schema" as const,
    json_schema: { name, strict: true, schema: json },
  };
}
