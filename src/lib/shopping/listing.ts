/** Authored merchandise profiles. Values are catalog data, never measured from a photo. */
export function listingProfile(label: string, category = "") {
  const text = `${label} ${category}`.toLowerCase();
  const profiles = [
    [
      /table lamp|ceramic.*lamp/,
      "Home accessories",
      "A softly diffused table lamp with a sculptural base and a warm, welcoming finish.",
      7900,
      "Ceramic base and fabric shade",
      "W28 × D28 × H45 cm",
    ],
    [
      /lamp|light/,
      "Lighting",
      "Sculptural lighting with a balanced silhouette and a warm, welcoming finish.",
      9900,
      "Powder-coated metal and fabric shade",
      "W38 × D38 × H155 cm",
    ],
    [
      /sofa|couch/,
      "Sofas",
      "Generous upholstered seating with a relaxed profile and softly textured finish.",
      59900,
      "Woven upholstery, foam cushions and timber frame",
      "W172 × D88 × H80 cm",
    ],
    [
      /chair|armchair/,
      "Lounge chairs",
      "Comfortable seating with a considered silhouette, supportive back and versatile finish.",
      19900,
      "Upholstery and solid wood frame",
      "W76 × D78 × H82 cm",
    ],
    [
      /stool/,
      "Stools",
      "Compact occasional seating with a simple profile and an easy-to-coordinate finish.",
      7900,
      "Solid wood",
      "W36 × D36 × H45 cm",
    ],
    [
      /cabinet|drawer|dresser|nightstand|night stand/,
      "Storage",
      "Practical storage with clean lines, a useful display surface and a warm finish.",
      17900,
      "Wood veneer, engineered wood and metal hardware",
      "W80 × D42 × H78 cm",
    ],
    [
      /table|desk/,
      "Side tables",
      "A versatile surface for everyday essentials, with a clean silhouette and durable finish.",
      8900,
      "Finished wood",
      "W60 × D50 × H48 cm",
    ],
    [
      /bed(?!side)|mattress/,
      "Beds",
      "A comfortable bedroom centerpiece with an upholstered frame and a timeless profile.",
      64900,
      "Textile upholstery and timber frame",
      "W160 × D210 × H100 cm",
    ],
    [
      /pillow|duvet|blanket|cushion/,
      "Textiles",
      "A soft textured accent that adds a comfortable layer of color to your space.",
      3900,
      "Woven cotton blend",
      "W50 × D50 × H15 cm",
    ],
    [
      /shoe|sneaker|footwear/,
      "Footwear",
      "An everyday shoe with a textured upper, cushioned sole and streamlined profile.",
      12900,
      "Textile upper and rubber sole",
      "Size EU 42",
    ],
    [
      /shirt|tshirt|t-shirt|dress|garment|shorts/,
      "Clothing",
      "An easy everyday essential with a clean cut and soft-touch fabric.",
      4900,
      "Cotton blend",
      "Size M",
    ],
    [
      /clock|watch/,
      "Accessories",
      "A distinctive timepiece with a clear display and thoughtfully finished details.",
      5900,
      "Metal, glass and polymer",
      "W15 × D6 × H8 cm",
    ],
    [
      /laptop|computer/,
      "Electronics",
      "A streamlined device for an organized workspace and everyday productivity.",
      89900,
      "Aluminum and glass",
      "W32 × D22 × H2 cm",
    ],
    [
      /mouse|keyboard/,
      "Electronics",
      "A compact workspace essential with a clean finish and comfortable proportions.",
      4900,
      "Polymer and metal",
      "W12 × D7 × H4 cm",
    ],
    [
      /vase|jar|tumbler|container|mug|bottle|box/,
      "Home accessories",
      "A useful sculptural accent with a tactile finish, ideal for a shelf, cabinet or table.",
      3900,
      "Finished ceramic",
      "W16 × D16 × H24 cm",
    ],
  ] as const;
  const p = profiles.find(([pattern]) => pattern.test(text));
  return {
    category: p?.[1] ?? "Products",
    description:
      p?.[2] ??
      "A thoughtfully finished piece with a distinctive silhouette, ready to complement your collection.",
    price: ((p?.[3] ?? 4900) / 100).toFixed(2),
    materials: p?.[4] ?? "Mixed materials",
    dimensions: p?.[5] ?? "Standard size",
    care: "Clean gently with a soft cloth. Follow material-specific care instructions.",
    colors: [
      { name: "Original", value: null, swatch: "#a99b85" },
      { name: "Warm sand", value: "#dfcda7", swatch: "#dfcda7" },
      { name: "Forest", value: "#789b82", swatch: "#789b82" },
      { name: "Clay", value: "#c9967a", swatch: "#c9967a" },
      { name: "Charcoal", value: "#737d78", swatch: "#737d78" },
    ],
    styles: ["modern", "warm", "minimal"],
  };
}

export function decimalToCents(value: string) {
  if (!/^(0|[1-9]\d{0,8})(\.\d{1,2})?$/.test(value))
    throw new Error("Invalid catalog price");
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
