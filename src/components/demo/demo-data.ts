export const demoProducts = {
  sofa: { name: "The everyday sofa", category: "Soft seating", price: "$840", color: "#b7b3a2", description: "A little room to slow down. Select an object to explore its product card." },
  table: { name: "Round oak table", category: "Living room", price: "$245", color: "#b88c60", description: "A warm wood finish and a soft, rounded silhouette. Every object has its own story." },
  lamp: { name: "Arc floor lamp", category: "Lighting", price: "$129", color: "#d9cfb8", description: "A soft pool of light for your favorite corner. Products stay connected as you explore." }
} as const;

export type DemoObject = keyof typeof demoProducts;
