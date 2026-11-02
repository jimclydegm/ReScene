import products from "./catalog-data.json";
import collections from "./collections-data.json";
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
  role?: string;
  imagePath?: string;
  colors: { name: string; value: string | null; swatch: string }[];
};
// Approved catalog snapshot exported from Neon. Prices are integer USD cents.
export const demoProducts: DemoProduct[] = products;
export const collectionProducts: Record<string, string[]> = Object.fromEntries(
  collections.map((c) => [c.id, c.products]),
);
export const collectionInfo: Record<string, { name: string; caption: string }> =
  Object.fromEntries(
    collections.map((c) => [c.id, { name: c.name, caption: c.caption }]),
  );
export const collectionIds = collections.map((c) => c.id);
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
export const demoImage = (id: string) =>
  findDemoProduct(id)?.imagePath ?? `/demo/images/${id}.webp`;
