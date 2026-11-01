async function interpret(id: string) {
  "use step";
  await (await import("@/lib/services/shopping-stylist")).interpretShopping(id);
}
interpret.maxRetries = 0;
async function coordinate(id: string) {
  "use step";
  await (await import("@/lib/services/shopping-stylist")).completeShopping(id);
}
coordinate.maxRetries = 0;
export async function styleShoppingScene(id: string) {
  "use workflow";
  await interpret(id);
  await coordinate(id);
}
