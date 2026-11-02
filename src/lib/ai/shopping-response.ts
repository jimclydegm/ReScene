/** Safe diagnostics only: never retain generated text, prompts or provider IDs. */
export class ShoppingResponseError extends Error {
  constructor(
    public code: "SHOPPING_RESPONSE_LENGTH" | "SHOPPING_RESPONSE_REFUSAL" | "SHOPPING_RESPONSE_INVALID",
    public diagnostic: { finishReason: string; usage: unknown },
  ) {
    super(code);
    this.name = "ShoppingResponseError";
  }
}
