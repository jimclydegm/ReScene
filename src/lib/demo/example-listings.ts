import { exampleProducts, exampleSceneProducts } from "./example-batch";
import type { DemoProduct } from "./catalog";

export const exampleFinishes = [
  { name: "Original", value: null, swatch: "#aaa291" },
  { name: "Warm ivory", value: "#dfd5bf", swatch: "#dfd5bf" },
  { name: "Forest", value: "#789b82", swatch: "#789b82" },
  { name: "Clay", value: "#c9967a", swatch: "#c9967a" },
  { name: "Deep blue", value: "#829bb9", swatch: "#829bb9" },
  { name: "Charcoal", value: "#737d78", swatch: "#737d78" },
];
function finishes(text: string, original?: string) {
  const color = text
    .match(
      /ivory|oat|white|cream|sage|blue|navy|terracotta|clay|caramel|brown|walnut|oak|ash|silver|steel|gray|grey|graphite|black|charcoal|taupe|sand|natural|amber|night/i,
    )?.[0]
    .toLowerCase();
  const swatches: Record<string, string> = {
    ivory: "#eee8de",
    oat: "#ded0b8",
    white: "#eeeae4",
    cream: "#e8dec5",
    sage: "#80977d",
    blue: "#77a8bd",
    navy: "#304c68",
    terracotta: "#ad6952",
    clay: "#ad6952",
    caramel: "#ae7651",
    brown: "#805537",
    walnut: "#754c35",
    oak: "#b98d60",
    ash: "#c7ad86",
    silver: "#b5b9bc",
    steel: "#b5b9bc",
    gray: "#92999b",
    grey: "#92999b",
    graphite: "#3b4144",
    black: "#303638",
    charcoal: "#3b4144",
    taupe: "#afa092",
    sand: "#cfbfa4",
    natural: "#d6c8af",
    amber: "#c6924a",
    night: "#303638",
  };
  return [
    {
      ...exampleFinishes[0],
      swatch: original ?? swatches[color ?? ""] ?? exampleFinishes[0].swatch,
    },
    ...exampleFinishes.slice(1),
  ];
}
const sceneSwatches: Record<string, string[]> = {
  "home-essentials": ["#eeeae4", "#aa8054", "#aa8054"],
  playtime: ["#dbb532", "#5ca2bb", "#5ca2bb", "#cc3530", "#efc447"],
  workspace: ["#b5b9bc", "#b5b9bc", "#303638", "#303638"],
  "chair-studio": ["#d7c9b2", "#9a734f", "#999d9d", "#9a734f"],
  appliances: ["#eae7e1", "#e2d7b8", "#eae7e1"],
  "daily-carry": ["#805537", "#d6c8af", "#cfbfa4"],
  fragrance: ["#d7d5ce", "#cbb08a", "#303638"],
  "city-style": ["#afa092", "#a6a8a8", "#d7c9b2"],
};
// Authored catalog specifications, never inferred physical measurements.
const sceneProfiles: Record<
  string,
  [string, string, string, number, string, string][]
> = {
  "home-essentials": [
    [
      "Alto White Refrigerator",
      "Appliances",
      "fridge",
      59900,
      "Painted steel, glass shelves and polymer trim",
      "W60 × D62 × H155 cm",
    ],
    [
      "Line Padded Oak Chair",
      "Dining chairs",
      "chair",
      12900,
      "Oak frame and woven cotton seat",
      "W46 × D51 × H82 cm",
    ],
    [
      "Forma Classic Four-Drawer Chest",
      "Storage",
      "drawer",
      28900,
      "Oak veneer, timber legs and metal handles",
      "W80 × D42 × H88 cm",
    ],
  ],
  playtime: [
    [
      "Playtime Color Ball",
      "Toys",
      "ball",
      1900,
      "Textured soft-touch polymer",
      "W18 × D18 × H18 cm",
    ],
    [
      "Playtime Friends Mug",
      "Mugs",
      "mug",
      2900,
      "Illustrated glazed ceramic",
      "W12 × D9 × H10 cm · 350 ml",
    ],
    [
      "Dino Lunch Box",
      "Containers",
      "lunchbox",
      2400,
      "Molded polymer with illustrated lid",
      "W22 × D16 × H7 cm",
    ],
    [
      "Little Red Play Car",
      "Toys",
      "toycar",
      1400,
      "Soft-touch molded polymer",
      "W8 × D14 × H7 cm",
    ],
    [
      "Rainbow Crayon Set",
      "Stationery",
      "crayons",
      1200,
      "Wax crayons and printed card box",
      "W14 × D10 × H3 cm",
    ],
  ],
  workspace: [
    [
      "Everyday Steel Tumbler",
      "Drinkware",
      "tumbler",
      1900,
      "Brushed stainless steel",
      "W8 × D8 × H13 cm · 400 ml",
    ],
    [
      "Slate Silver Notebook Computer",
      "Computers",
      "laptop",
      89900,
      "Aluminum chassis and glass display",
      "W32 × D22 × H2 cm",
    ],
    [
      "Studio Charcoal Notebook",
      "Stationery",
      "notebook",
      1900,
      "Cloth-bound board and paper",
      "W15 × D21 × H2 cm",
    ],
    [
      "Quiet Graphite Wireless Mouse",
      "Computer mice",
      "mouse",
      4900,
      "Matte polymer and rubber wheel",
      "W7 × D12 × H4 cm",
    ],
  ],
  "chair-studio": [
    [
      "Haven Oat Armchair",
      "Lounge chairs",
      "chair",
      22900,
      "Woven upholstery, foam and walnut legs",
      "W76 × D78 × H82 cm",
    ],
    [
      "Line Classic Oak Chair",
      "Dining chairs",
      "chair",
      11900,
      "Solid oak",
      "W46 × D51 × H82 cm",
    ],
    [
      "Form Gray Dining Chair",
      "Dining chairs",
      "chair",
      9900,
      "Molded polymer and powder-coated steel",
      "W48 × D52 × H80 cm",
    ],
    [
      "Everyday Oak Stool",
      "Stools",
      "stool",
      7900,
      "Solid oak",
      "W36 × D36 × H45 cm",
    ],
  ],
  appliances: [
    [
      "Alto White Two-Door Refrigerator",
      "Appliances",
      "fridge",
      59900,
      "Painted steel and glass shelving",
      "W60 × D62 × H160 cm",
    ],
    [
      "Retro Cream Refrigerator",
      "Appliances",
      "fridge",
      64900,
      "Cream painted steel and metal handle",
      "W58 × D62 × H155 cm",
    ],
    [
      "Compact White Refrigerator",
      "Appliances",
      "fridge",
      49900,
      "Painted steel and glass shelving",
      "W55 × D58 × H145 cm",
    ],
  ],
  "daily-carry": [
    [
      "Heritage Brown Lace-Up",
      "Footwear",
      "shoes",
      12900,
      "Leather upper and rubber sole",
      "Size EU 42",
    ],
    [
      "Everyday Natural Tote",
      "Bags",
      "tote",
      3900,
      "Heavy cotton canvas",
      "W38 × D10 × H40 cm",
    ],
    [
      "Studio Sand Cap",
      "Accessories",
      "cap",
      2400,
      "Cotton twill",
      "Adjustable adult size",
    ],
  ],
  fragrance: [
    [
      "Pure No. 01 Eau de Parfum",
      "Fragrances",
      "perfume",
      8900,
      "Glass bottle and brushed metal cap",
      "W7 × D4 × H14 cm · 100 ml",
    ],
    [
      "Amber No. 02 Eau de Parfum",
      "Fragrances",
      "perfume",
      10900,
      "Clear glass and gold-tone metal cap",
      "W10 × D4 × H12 cm · 80 ml",
    ],
    [
      "Night No. 03 Eau de Parfum",
      "Fragrances",
      "perfume",
      7900,
      "Clear glass and matte black cap",
      "W4 × D4 × H17 cm · 50 ml",
    ],
  ],
  "city-style": [
    [
      "Quilt Taupe Top-Handle Bag",
      "Bags",
      "handbag",
      14900,
      "Quilted leather and gold-tone hardware",
      "W26 × D10 × H22 cm",
    ],
    [
      "Everyday Gray Runner",
      "Footwear",
      "shoes",
      10900,
      "Mesh, suede panels and rubber sole",
      "Size EU 42",
    ],
    [
      "Soft Oat Suede Loafer",
      "Footwear",
      "shoes",
      7900,
      "Suede upper and rubber sole",
      "Size EU 42",
    ],
  ],
};
export function exampleListing(id: string): DemoProduct {
  const variation = exampleProducts.find((p) => p.id === id);
  if (variation) {
    const category =
      variation.kind === "chair" && !/armchair/i.test(variation.name)
        ? "Dining chairs"
        : variation.category;
    return {
      id,
      name: variation.name,
      subtitle: category,
      price: variation.price,
      category,
      role: variation.kind,
      description: variation.description,
      materials: variation.materials,
      dimensions: variation.dimensions,
      care: variation.care,
      colors: finishes(variation.design),
      imagePath: `/demo/expansion/${id}.webp`,
    };
  }
  const product = exampleSceneProducts.find((p) => p.id === id);
  if (!product) throw new Error("Unknown approved example product");
  const [name, category, role, price, materials, dimensions] =
    sceneProfiles[product.sceneKey][product.index];
  return {
    id,
    name,
    subtitle: category,
    price,
    category,
    role,
    description: `${name} brings ${materials.toLowerCase()} and a carefully finished silhouette to the collection. Explore the details in 3D and coordinate it with your everyday essentials.`,
    materials,
    dimensions,
    care: "Clean gently with a soft cloth. Follow the material care instructions supplied with the product.",
    colors: finishes(
      `${name} ${materials}`,
      sceneSwatches[product.sceneKey][product.index],
    ),
    imagePath: `/demo/expansion/${id}.webp`,
  };
}
