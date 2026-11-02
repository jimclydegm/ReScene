/** Explicitly curated Muse Image generation brief. Input files stay outside public assets. */
export const exampleScenes = [
  {
    id: "home-essentials",
    title: "Home essentials",
    file: "d3wAK.jpg",
    inventory:
      "one white two-door refrigerator on the left, one wooden upholstered-seat dining chair in the middle, one wooden four-drawer chest on the right",
    caption: "Appliance, chair and drawers.",
    concepts: ["refrigerator", "wooden chair", "wooden chest of drawers"],
  },
  {
    id: "playtime",
    title: "Playtime desk",
    file: "H3wtH.jpg",
    inventory:
      "one multicolored toy ball, one blue illustrated ceramic mug, one blue dinosaur lunchbox with attached closed lid, one red toy car, one closed colorful crayon box",
    caption: "Colorful everyday objects on a wooden surface.",
    concepts: ["toy ball", "mug", "lunch box", "red toy car", "crayon box"],
  },
  {
    id: "workspace",
    title: "Quiet workspace",
    file: "Jnlle.jpg",
    inventory:
      "one stainless steel tumbler, one closed silver laptop, one dark closed notebook, one black wireless computer mouse",
    caption: "Laptop, mouse, notebook and tumbler.",
    concepts: ["metal tumbler", "closed laptop", "notebook", "computer mouse"],
  },
  {
    id: "chair-studio",
    title: "Seating collection",
    file: "kgXuG.jpg",
    inventory:
      "one beige upholstered armchair, one wooden dining chair, one gray molded dining chair with black legs, one wooden stool",
    caption: "Four seating styles with tactile materials.",
    concepts: [
      "upholstered armchair",
      "wooden dining chair",
      "gray chair",
      "wooden stool",
    ],
  },
  {
    id: "appliances",
    title: "Appliance collection",
    file: "MmoD6.jpg",
    inventory:
      "three distinct freestanding refrigerators in a row: white two-door left, cream single-door center, white two-door right",
    caption: "Three refrigerators in a clean tiled setting.",
    concepts: [
      "left refrigerator",
      "middle refrigerator",
      "right refrigerator",
    ],
  },
  {
    id: "daily-carry",
    title: "Everyday carry",
    file: "MTpzk.jpg",
    inventory:
      "one single brown leather lace-up shoe on the left, one natural canvas tote bag in the center, one beige baseball cap on the right",
    caption: "Leather, canvas and cotton details.",
    concepts: ["leather shoe", "tote bag", "baseball cap"],
  },
  {
    id: "fragrance",
    title: "Fragrance collection",
    file: "sRClw.jpg",
    inventory:
      "three separate perfume bottles on a gray counter: rectangular glass bottle with silver cap left, round glass bottle with gold cap center, tall slim glass bottle with black cap right",
    caption: "Glass and metal on a warm studio backdrop.",
    concepts: [
      "left perfume bottle",
      "middle perfume bottle",
      "right perfume bottle",
    ],
  },
  {
    id: "city-style",
    title: "City essentials",
    file: "Tnomr.jpg",
    inventory:
      "one taupe quilted handbag with gold clasp left, one single gray and white lace-up sneaker center, one single beige suede loafer right",
    caption: "Handbag and two distinct single shoes.",
    concepts: ["handbag", "sneaker", "loafer"],
  },
] as const;

export const exampleSceneProducts = exampleScenes.flatMap((s) =>
  s.concepts.map((concept, index) => ({
    id: `${s.id}-item-${index + 1}`,
    sceneKey: s.id,
    index,
    concept,
    reference: s.file,
    name: concept.replace(/\b\w/g, (c) => c.toUpperCase()),
  })),
);

const group = (
  kind: string,
  category: string,
  reference: string,
  items: [string, string, string, number, string, string][],
) =>
  items.map(([id, name, design, price, materials, dimensions]) => ({
    id,
    kind,
    category,
    reference,
    name,
    design,
    price,
    materials,
    dimensions,
    description: (() => {
      const text = design
        .replace(/, no [^,]+/g, "")
        .replace(/, empty/g, "")
        .replace(/^one (single )?/, "a ");
      const benefit: Record<string, string> = {
        chair:
          "An easy-to-coordinate silhouette with a carefully finished frame.",
        drawer:
          "Keep everyday essentials organized in practical storage with a compact footprint.",
        mouse:
          "An everyday workspace essential with a clean finish and a useful scroll wheel.",
        sofa: "Comfortable cushioning and a compact shape that coordinates easily with your space.",
        shoes:
          "A versatile everyday style with a neatly finished upper and a rubber sole.",
        mug: "An everyday cup for tea or coffee, with a comfortable handle and a glazed interior.",
      };
      return `${text[0].toUpperCase() + text.slice(1)}. ${benefit[kind]}`;
    })(),
    care: "Clean gently with a soft cloth and follow material-specific care instructions.",
  }));
export const exampleProducts = [
  ...group("chair", "Lounge chairs", "kgXuG.jpg", [
    [
      "haven-linen-chair",
      "Haven Linen Armchair",
      "a rounded ivory linen armchair with four walnut legs and one thick fitted seat cushion",
      22900,
      "Linen upholstery, foam and walnut frame",
      "W76 × D78 × H82 cm",
    ],
    [
      "line-oak-chair",
      "Line Oak Dining Chair",
      "a straight solid oak dining chair with a slatted back and a pale woven seat pad",
      11900,
      "Solid oak and woven cotton cushion",
      "W46 × D51 × H82 cm",
    ],
    [
      "form-sage-chair",
      "Form Sage Chair",
      "a sage green molded shell chair with four slender matte black metal legs",
      9900,
      "Molded polymer and steel",
      "W48 × D52 × H80 cm",
    ],
    [
      "cove-terracotta-chair",
      "Cove Terracotta Armchair",
      "a terracotta textured fabric barrel armchair with a curved back and tapered oak legs",
      25900,
      "Textured woven upholstery and oak",
      "W78 × D79 × H81 cm",
    ],
    [
      "nord-walnut-chair",
      "Nord Walnut Chair",
      "a walnut dining chair with a simple curved back rail and a dark brown upholstered flat seat",
      14900,
      "Solid walnut and textile upholstery",
      "W48 × D52 × H79 cm",
    ],
  ]),
  ...group("drawer", "Storage", "d3wAK.jpg", [
    [
      "forma-oak-drawers",
      "Forma Oak Drawers",
      "a compact natural oak four-drawer chest with straight legs and discreet dark handles",
      27900,
      "Oak veneer and solid oak legs",
      "W80 × D42 × H88 cm",
    ],
    [
      "arc-white-drawers",
      "Arc White Drawers",
      "a matte warm-white three-drawer chest with oak feet and small circular wooden pulls",
      19900,
      "Painted engineered wood and oak",
      "W75 × D40 × H78 cm",
    ],
    [
      "line-walnut-drawers",
      "Line Walnut Drawers",
      "a dark walnut three-drawer chest with flush fronts and simple brass bar handles",
      32900,
      "Walnut veneer and brass hardware",
      "W85 × D43 × H80 cm",
    ],
    [
      "studio-sage-drawers",
      "Studio Sage Drawers",
      "a muted sage painted four-drawer chest on short natural wood legs with minimal black handles",
      23900,
      "Painted wood and steel hardware",
      "W78 × D42 × H86 cm",
    ],
    [
      "ridge-ash-drawers",
      "Ridge Ash Drawers",
      "a light ash two-drawer wide chest with flat fronts and simple inset horizontal pulls",
      17900,
      "Ash veneer and solid wood",
      "W90 × D42 × H68 cm",
    ],
  ]),
  ...group("mouse", "Computer mice", "Jnlle.jpg", [
    [
      "pebble-ivory-mouse",
      "Pebble Ivory Mouse",
      "a compact warm ivory oval wireless computer mouse with two top buttons and one black scroll wheel",
      2900,
      "Matte polymer and rubber scroll wheel",
      "W6 × D10 × H3 cm",
    ],
    [
      "arc-graphite-mouse",
      "Arc Graphite Mouse",
      "a graphite ergonomic wireless mouse with a gently arched body, two buttons and a rubber scroll wheel",
      4900,
      "Textured polymer and rubber",
      "W7 × D12 × H4 cm",
    ],
    [
      "slim-silver-mouse",
      "Slim Silver Mouse",
      "a slim brushed silver wireless mouse with a white top panel and a small central scroll wheel",
      5900,
      "Aluminum and matte polymer",
      "W6 × D11 × H2.5 cm",
    ],
    [
      "studio-sage-mouse",
      "Studio Sage Mouse",
      "a soft sage green compact wireless mouse with a smooth rounded two-button shell and dark scroll wheel",
      3900,
      "Soft-touch polymer and rubber",
      "W6 × D10.5 × H3.5 cm",
    ],
    [
      "precision-black-mouse",
      "Precision Black Mouse",
      "a matte black wireless performance mouse with a subtle ergonomic contour, two side buttons and one scroll wheel, no RGB lights",
      6900,
      "Matte polymer and rubber grips",
      "W7 × D12.5 × H4.5 cm",
    ],
  ]),
  ...group("sofa", "Sofas", "public/demo/images/cloud-sofa.webp", [
    [
      "cloud-ivory-sofa",
      "Cloud Ivory Sofa",
      "an ivory boucle two-seat sofa with two fitted seat cushions, a continuous rounded back and four short oak legs, no loose pillows",
      59900,
      "Boucle upholstery, foam and timber frame",
      "W175 × D88 × H80 cm",
    ],
    [
      "cove-sage-sofa",
      "Cove Sage Sofa",
      "a muted sage woven-fabric two-seat sofa with slim rounded arms and tapered walnut legs, no loose pillows",
      64900,
      "Woven polyester and walnut legs",
      "W180 × D88 × H82 cm",
    ],
    [
      "line-caramel-sofa",
      "Line Caramel Sofa",
      "a caramel leather two-seat sofa with straight padded arms, two seat cushions and dark wood feet, no loose pillows",
      79900,
      "Leather upholstery and timber frame",
      "W178 × D86 × H79 cm",
    ],
    [
      "haven-blue-sofa",
      "Haven Blue Sofa",
      "a dusty blue textured-fabric compact sofa with a softly curved back and slender oak legs, no loose pillows",
      54900,
      "Textured upholstery and oak legs",
      "W170 × D85 × H80 cm",
    ],
    [
      "studio-charcoal-sofa",
      "Studio Charcoal Sofa",
      "a charcoal gray linen two-seat sofa with clean rectangular cushions and matte black short legs, no loose pillows",
      49900,
      "Linen blend upholstery and steel feet",
      "W172 × D86 × H78 cm",
    ],
  ]),
  ...group("shoes", "Footwear", "Tnomr.jpg", [
    [
      "court-white-sneaker",
      "Court White Sneaker",
      "one single white low-top leather lace-up sneaker with subtle gray heel panel and a clean white rubber cup sole",
      8900,
      "Leather upper and rubber sole",
      "Size EU 42",
    ],
    [
      "trail-sage-sneaker",
      "Trail Sage Sneaker",
      "one single sage and cream mesh running sneaker with neat laces and a continuous solid off-white foam sole, no holes in the sole",
      10900,
      "Mesh textile and foam rubber sole",
      "Size EU 42",
    ],
    [
      "derby-brown-shoe",
      "Derby Brown Shoe",
      "one single rich brown leather lace-up derby shoe with neat stitching, a rounded toe and a low dark sole",
      12900,
      "Leather upper and rubber sole",
      "Size EU 42",
    ],
    [
      "soft-sand-loafer",
      "Soft Sand Loafer",
      "one single sand suede slip-on loafer with a rounded moccasin toe and thin textured rubber sole",
      7900,
      "Suede upper and rubber sole",
      "Size EU 42",
    ],
    [
      "canvas-navy-shoe",
      "Canvas Navy Shoe",
      "one single navy canvas low-top lace-up sneaker with white stitching and a simple white rubber sole",
      5900,
      "Cotton canvas and rubber",
      "Size EU 42",
    ],
  ]),
  ...group("mug", "Mugs", "H3wtH.jpg", [
    [
      "everyday-ivory-mug",
      "Everyday Ivory Mug",
      "one warm ivory ceramic mug with a gently rounded body and one generous C-shaped handle, empty",
      1900,
      "Glazed ceramic",
      "W12 × D9 × H10 cm · 350 ml",
    ],
    [
      "terra-clay-mug",
      "Terra Clay Mug",
      "one terracotta ceramic mug with a matte exterior, cream glazed interior and one rounded handle, empty",
      2400,
      "Glazed stoneware",
      "W12 × D9 × H10 cm · 350 ml",
    ],
    [
      "forest-sage-mug",
      "Forest Sage Mug",
      "one sage green glazed ceramic mug with a subtly ribbed body and one smooth handle, empty",
      2200,
      "Glazed ceramic",
      "W12 × D9 × H10 cm · 350 ml",
    ],
    [
      "coast-blue-mug",
      "Coast Blue Mug",
      "one powder blue ceramic mug with a glossy white interior and one large curved handle, empty",
      2100,
      "Glazed ceramic",
      "W12 × D9 × H10 cm · 350 ml",
    ],
    [
      "playtime-bear-mug",
      "Playtime Bear Mug",
      "one sky-blue ceramic mug with one blue handle, a simple charming original brown bear illustration and small yellow stars, white interior, empty, no text",
      2900,
      "Printed glazed ceramic",
      "W12 × D9 × H10 cm · 350 ml",
    ],
  ]),
];
