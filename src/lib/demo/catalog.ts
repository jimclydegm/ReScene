import products from "./catalog-data.json";
export type DemoProduct = {
  id: string;
  name: string;
  subtitle: string;
  price: number;
  category: string;
  description: string;
  materials: string;
  dimensions: string;
  care: string;
  colors: { name: string; value: string | null; swatch: string }[];
};
// Approved catalog snapshot exported from Neon. Prices are integer USD cents.
export const demoProducts: DemoProduct[] = products;
export const collectionProducts: Record<string, string[]> = {
  corner: ["corner-chair", "corner-cabinet", "corner-vase"],
  space: ["oak-dresser", "sage-chair", "round-table", "dining-chair"],
  living: ["cloud-sofa", "coffee-table", "wood-stool", "ceramic-vase"],
};
export const collectionInfo: Record<string, { name: string; caption: string }> =
  {
    corner: {
      name: "The Reading Corner",
      caption: "A lounge chair, oak cabinet and terracotta vase.",
    },
    space: {
      name: "The Everyday Collection",
      caption: "Four pieces. Plenty of ways to make them yours.",
    },
    living: {
      name: "The Sunday Living Room",
      caption: "A cream sofa, warm wood and a quiet place to slow down.",
    },
  };
export const findDemoProduct = (id: string) =>
  demoProducts.find((p) => p.id === id);
export const itemProductId = (id: string, item: { productId?: string }) =>
  item.productId ?? id;
// These are authored fictional listing dimensions, not measurements from AI.
export const demoListingHeight = (id: string) =>
  Number(findDemoProduct(id)?.dimensions.match(/H([\d.]+)\s*cm/)?.[1]) || null;
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
export const demoImage = (id: string) => `/demo/images/${id}.webp`;
