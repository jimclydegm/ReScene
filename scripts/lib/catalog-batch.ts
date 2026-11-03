import * as original from "../../src/lib/demo/example-batch";
import { catalogExpansion } from "../../src/lib/demo/catalog-expansion";
import { exampleListing, variationListing } from "../../src/lib/demo/example-listings";

const expanded = process.env.EXAMPLE_BATCH === "catalog-prices-v2";
if (process.env.EXAMPLE_BATCH && !expanded && process.env.EXAMPLE_BATCH !== "demo-expansion-v1")
  throw new Error("Unknown curation batch; refusing paid work");
export const batchId = expanded ? "catalog-prices-v2" : "demo-expansion-v1";
export const batchFolder = `test-results/${batchId}`;
export const imageOutput = expanded ? "public/demo/catalog-v2" : "public/demo/expansion";
export const exampleProducts = expanded ? catalogExpansion : original.exampleProducts;
export const exampleScenes = expanded ? [] : original.exampleScenes;
export const exampleSceneProducts = expanded ? [] : original.exampleSceneProducts;
export const listingFor = (id: string) => {
  const p = expanded && catalogExpansion.find(p => p.id === id);
  return p ? variationListing(p, "/demo/catalog-v2") : exampleListing(id);
};
