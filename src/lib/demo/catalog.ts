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
// Authored fictional listings, deliberately separate from merchant Product records.
// Prices are integer USD cents. Dimensions/materials are illustrative, not measured.
export const demoProducts: DemoProduct[] = [
  {
    id: "sage-chair",
    name: "Sage Lounge Chair",
    subtitle: "A softer place to land.",
    price: 24900,
    category: "Lounge chairs",
    description:
      "A gently curved back, generous seat and a quiet sage finish. Make a reading corner, or pair it with a small table for your everyday rituals.",
    materials:
      "Sample: woven polyester upholstery, foam cushioning, solid wood legs",
    dimensions: "Sample: W76 × D78 × H82 cm",
    care: "Vacuum with a soft attachment. Spot clean with a damp cloth.",
    colors: [
      { name: "Original sage", value: null, swatch: "#8e9b80" },
      { name: "Warm sand", value: "#dfcda7", swatch: "#dfcda7" },
      { name: "Dusty blue", value: "#a5bad3", swatch: "#a5bad3" },
    ],
  },
  {
    id: "round-table",
    name: "Arc Side Table",
    subtitle: "Small footprint. Everyday company.",
    price: 8900,
    category: "Side tables",
    description:
      "A simple round companion for a book, a cup, or a moment to yourself. Its clean silhouette works beside a sofa or your favorite chair.",
    materials: "Sample: painted engineered wood",
    dimensions: "Sample: Ø45 × H48 cm",
    care: "Wipe dry after cleaning. Use a coaster for hot drinks.",
    colors: [
      { name: "Original chalk", value: null, swatch: "#eceae2" },
      { name: "Oat", value: "#d7c8ab", swatch: "#d7c8ab" },
      { name: "Slate", value: "#7f8c96", swatch: "#7f8c96" },
    ],
  },
  {
    id: "oak-dresser",
    name: "Forma Three-Drawer Dresser",
    subtitle: "Everything in its place.",
    price: 27900,
    category: "Storage",
    description:
      "Warm wood and three practical drawers bring an easy sense of order. A compact storage piece for a bedroom, hallway or living space.",
    materials: "Sample: oak veneer, engineered wood, solid wood legs",
    dimensions: "Sample: W90 × D42 × H78 cm",
    care: "Dust with a dry cloth. Keep away from prolonged moisture.",
    colors: [
      { name: "Original oak", value: null, swatch: "#b98b59" },
      { name: "Smoked oak", value: "#8d7465", swatch: "#8d7465" },
    ],
  },
  {
    id: "dining-chair",
    name: "Line Dining Chair",
    subtitle: "An everyday classic.",
    price: 11900,
    category: "Dining chairs",
    description:
      "An open slatted back and a familiar wooden silhouette. Pull up a seat wherever good conversation happens.",
    materials: "Sample: solid wood with a clear protective finish",
    dimensions: "Sample: W46 × D51 × H82 cm",
    care: "Wipe with a soft, slightly damp cloth.",
    colors: [
      { name: "Original wood", value: null, swatch: "#ba885b" },
      { name: "Dark walnut", value: "#806956", swatch: "#806956" },
    ],
  },
  {
    id: "cloud-sofa",
    name: "Cloud Two-Seat Sofa",
    subtitle: "Room for a slow afternoon.",
    price: 69900,
    category: "Sofas",
    description:
      "A relaxed two-seater with soft upholstery and an understated profile. An inviting anchor for a calm, considered living room.",
    materials: "Sample: textured polyester, foam cushions, timber frame",
    dimensions: "Sample: W172 × D88 × H80 cm",
    care: "Vacuum regularly and spot clean spills promptly.",
    colors: [
      { name: "Original cream", value: null, swatch: "#e8e3d8" },
      { name: "Sage", value: "#a7b09a", swatch: "#a7b09a" },
      { name: "Clay", value: "#c4a28e", swatch: "#c4a28e" },
    ],
  },
  {
    id: "coffee-table",
    name: "Gather Coffee Table",
    subtitle: "At the center of it all.",
    price: 14900,
    category: "Coffee tables",
    description:
      "A warm wooden surface for coffee, books and everything in between. Clean lines keep the room feeling open.",
    materials: "Sample: oak veneer and solid wood legs",
    dimensions: "Sample: W100 × D55 × H40 cm",
    care: "Use coasters. Wipe clean and dry.",
    colors: [
      { name: "Original oak", value: null, swatch: "#b89470" },
      { name: "Walnut", value: "#987a62", swatch: "#987a62" },
    ],
  },
  {
    id: "wood-stool",
    name: "Loop Wooden Stool",
    subtitle: "An extra seat, always welcome.",
    price: 7900,
    category: "Stools",
    description:
      "A compact round stool that moves easily from extra seating to a little bedside perch. Simple, useful and easy to live with.",
    materials: "Sample: solid wood",
    dimensions: "Sample: Ø35 × H45 cm",
    care: "Wipe with a dry cloth. For indoor use.",
    colors: [
      { name: "Original oak", value: null, swatch: "#bf9b73" },
      { name: "Smoked wood", value: "#988474", swatch: "#988474" },
    ],
  },
  {
    id: "ceramic-vase",
    name: "Still Ceramic Vase",
    subtitle: "A little sculptural quiet.",
    price: 3900,
    category: "Home accessories",
    description:
      "An understated ceramic silhouette with a soft neutral finish. Let it stand alone as a sculptural accent.",
    materials: "Sample: glazed ceramic",
    dimensions: "Sample: Ø20 × H32 cm",
    care: "Hand wash gently. Dry with a soft cloth.",
    colors: [
      { name: "Original ivory", value: null, swatch: "#eee9dc" },
      { name: "Terracotta", value: "#c3947c", swatch: "#c3947c" },
    ],
  },
];
export const findDemoProduct = (id: string) =>
  demoProducts.find((p) => p.id === id);
export const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
export const demoImage = (id: string) => `/demo/images/${id}.webp`;
