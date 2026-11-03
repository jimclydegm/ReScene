/** Authored catalog brief. Prices are USD cents; sizes are listing specifications. */
type Spec = [id: string, name: string, design: string, price: number, materials: string, dimensions: string];
const group = (kind: string, category: string, reference: string, specs: Spec[]) =>
  specs.map(([id, name, design, price, materials, dimensions]) => ({
    id, name, kind, category, reference, design, price, materials, dimensions,
    description: `${name} combines ${materials.toLowerCase()} with a practical, carefully finished design. ${design.replace(/^one (single )?/, "A ")}.`,
    care: /mug|vase/.test(kind)
      ? "Wash gently by hand with mild soap. Dry with a soft cloth."
      : /bag|shoes/.test(kind)
        ? "Spot clean with a soft cloth. Air dry away from direct heat."
        : "Dust with a soft cloth. Blot spills promptly and avoid abrasive cleaners.",
  }));

export const catalogExpansion = [
  ...group("table", "Side tables", "public/demo/images/round-table.webp", [
    ["pin-pine-side-table", "Pin Pine Side Table", "one small square natural pine side table with four straight legs and a flat empty top", 2900, "Solid pine", "W38 × D38 × H48 cm"],
    ["loop-white-side-table", "Loop White Side Table", "one white powder-coated steel round side table with three straight legs and a shallow round tray top", 4900, "Powder-coated steel", "W40 × D40 × H48 cm"],
    ["ember-walnut-side-table", "Ember Walnut Side Table", "one walnut round side table with a thick circular top and three tapered wooden legs", 13900, "Walnut veneer and solid timber legs", "W44 × D44 × H50 cm"],
    ["column-oak-side-table", "Column Oak Side Table", "one sculptural natural oak side table with a round flat top on a wide solid cylindrical pedestal", 24900, "Solid oak and oak veneer", "W42 × D42 × H50 cm"],
  ]),
  ...group("table", "Coffee tables", "public/demo/images/coffee-table.webp", [
    ["plain-birch-coffee-table", "Plain Birch Coffee Table", "one compact rectangular birch coffee table with four straight legs and a thin flat empty top", 6900, "Birch veneer and solid timber legs", "W85 × D48 × H40 cm"],
    ["curve-oak-coffee-table", "Curve Oak Coffee Table", "one low oval light oak coffee table with a flat thick top and four short tapered legs", 14900, "Oak veneer and solid oak", "W90 × D50 × H40 cm"],
    ["frame-black-coffee-table", "Frame Black Coffee Table", "one rectangular walnut coffee table with a flat wood top and two simple black steel rectangular end frames", 22900, "Walnut veneer and powder-coated steel", "W90 × D50 × H40 cm"],
    ["stone-cream-coffee-table", "Stone Cream Coffee Table", "one low rounded rectangular cream travertine coffee table with a solid stone slab top and two broad stone pedestal legs", 44900, "Honed travertine", "W90 × D50 × H38 cm"],
  ]),
  ...group("chair", "Dining chairs", "public/demo/expansion/line-oak-chair.webp", [
    ["daily-white-dining-chair", "Daily White Dining Chair", "one white molded dining chair with a smooth curved back and four straight black steel legs", 3900, "Molded polymer and steel", "W46 × D49 × H80 cm"],
    ["reed-pine-dining-chair", "Reed Pine Dining Chair", "one simple natural pine dining chair with four straight legs, a solid flat seat and three vertical back slats", 6900, "Solid pine", "W45 × D49 × H80 cm"],
    ["weave-oak-dining-chair", "Weave Oak Dining Chair", "one oak dining chair with a gently curved solid back rail, four tapered legs and a tightly woven natural paper cord seat", 18900, "Solid oak and woven paper cord", "W48 × D51 × H80 cm"],
    ["atelier-walnut-dining-chair", "Atelier Walnut Dining Chair", "one elegant walnut dining chair with a curved continuous back rail, four tapered walnut legs and a fitted cognac leather seat", 34900, "Solid walnut and leather", "W49 × D52 × H80 cm"],
  ]),
  ...group("chair", "Lounge chairs", "public/demo/expansion/haven-linen-chair.webp", [
    ["nest-gray-armchair", "Nest Gray Armchair", "one compact light gray upholstered armchair with a simple padded back, low padded arms and four short black wood legs", 12900, "Woven polyester, foam and timber", "W70 × D72 × H80 cm"],
    ["alto-mustard-armchair", "Alto Mustard Armchair", "one mustard yellow textured fabric armchair with a rounded back, fitted seat cushion and four tapered oak legs", 24900, "Textured upholstery and oak legs", "W74 × D74 × H81 cm"],
    ["ribbon-blue-armchair", "Ribbon Blue Armchair", "one dusty blue velvet armchair with a continuous curved back and arms, fitted cushion and four short walnut legs", 42900, "Velvet, foam and walnut", "W76 × D76 × H82 cm"],
    ["hearth-cognac-armchair", "Hearth Cognac Armchair", "one compact cognac leather armchair with tailored square arms, a fitted thick seat cushion and four walnut feet", 69900, "Leather, high-density foam and walnut", "W77 × D77 × H82 cm"],
  ]),
  ...group("drawer", "Storage", "public/demo/expansion/forma-oak-drawers.webp", [
    ["basic-white-drawers", "Basic White Drawers", "one compact white three-drawer chest with flat straight fronts, small black knob handles and a short solid plinth base", 5900, "Painted engineered wood and steel knobs", "W68 × D38 × H74 cm"],
    ["simple-pine-drawers", "Simple Pine Drawers", "one compact natural pine three-drawer chest with small round wooden knobs and four short square legs", 9900, "Solid pine", "W70 × D38 × H76 cm"],
    ["linen-oat-drawers", "Linen Oat Drawers", "one oatmeal painted three-drawer chest with slim oak handles and four short oak legs", 14900, "Painted engineered wood and oak", "W72 × D40 × H78 cm"],
    ["block-blue-drawers", "Block Blue Drawers", "one muted navy blue four-drawer chest with clean flat fronts, small brushed steel pulls and short square feet", 21900, "Painted wood and brushed steel", "W74 × D40 × H82 cm"],
    ["grove-oak-drawers", "Grove Oak Drawers", "one natural oak four-drawer chest with broad flat fronts, integrated recessed pulls and four tapered oak legs", 34900, "Oak veneer and solid oak", "W76 × D40 × H80 cm"],
    ["flute-sand-drawers", "Flute Sand Drawers", "one light ash three-drawer chest with fine vertical fluting on its drawer fronts and a simple short solid wood base", 44900, "Ash veneer and solid timber", "W76 × D40 × H80 cm"],
    ["heritage-walnut-drawers", "Heritage Walnut Drawers", "one walnut three-drawer chest with flush flat fronts, understated antique brass handles and short tapered walnut legs", 59900, "Walnut veneer, timber and brass", "W78 × D42 × H82 cm"],
    ["atelier-ink-drawers", "Atelier Ink Drawers", "one charcoal stained oak three-drawer chest with subtle horizontal grain, small bronze bar handles and a recessed plinth base", 79900, "Solid oak, oak veneer and bronze hardware", "W78 × D42 × H82 cm"],
  ]),
  ...group("sofa", "Sofas", "public/demo/expansion/cloud-ivory-sofa.webp", [
    ["daily-gray-sofa", "Daily Gray Sofa", "one compact light gray two-seat sofa with straight padded arms, two fitted seat cushions and four short black feet", 24900, "Woven polyester, foam and timber", "W160 × D80 × H78 cm"],
    ["park-sand-sofa", "Park Sand Sofa", "one compact sand linen two-seat sofa with gently rounded arms, two fitted cushions and four tapered pine legs", 34900, "Linen blend and timber", "W164 × D82 × H79 cm"],
    ["brook-olive-sofa", "Brook Olive Sofa", "one muted olive green two-seat sofa with clean rectangular fitted cushions, narrow upholstered arms and short walnut legs", 44900, "Textured woven upholstery and walnut", "W168 × D82 × H80 cm"],
    ["shore-blue-sofa", "Shore Blue Sofa", "one dusty blue corduroy two-seat sofa with broad soft arms, two fitted seat cushions and four oak feet", 69900, "Cotton blend corduroy and oak", "W170 × D84 × H80 cm"],
    ["arc-cream-sofa", "Arc Cream Sofa", "one cream boucle two-seat sofa with a softly curved continuous padded back, two fitted seat cushions and a short oak plinth base", 89900, "Boucle, high-density foam and oak", "W172 × D84 × H80 cm"],
    ["loft-tan-sofa", "Loft Tan Sofa", "one tan leather two-seat sofa with straight padded arms, two tailored fitted seat cushions and four walnut feet", 119900, "Leather and solid timber", "W172 × D84 × H80 cm"],
    ["salon-rust-sofa", "Salon Rust Sofa", "one rust velvet two-seat sofa with a curved padded back, rounded arms and four short dark walnut legs", 149900, "Cotton velvet and walnut", "W174 × D85 × H81 cm"],
    ["atelier-cocoa-sofa", "Atelier Cocoa Sofa", "one premium dark cocoa leather two-seat sofa with clean square arms, two deeply padded fitted cushions and short solid oak feet", 189900, "Leather, resilient foam and solid oak", "W174 × D85 × H81 cm"],
  ]),
  ...group("mug", "Mugs", "public/demo/expansion/everyday-ivory-mug.webp", [
    ["daily-white-mug", "Daily White Mug", "one simple glossy white ceramic mug with a straight cylinder body and one rounded C-shaped handle", 600, "Glazed ceramic", "W12 × D9 × H10 cm · 350 ml"],
    ["rise-yellow-mug", "Rise Yellow Mug", "one warm yellow ceramic mug with a gently rounded body, white interior and one curved handle", 1000, "Glazed ceramic", "W12 × D9 × H10 cm · 350 ml"],
    ["dune-speckled-mug", "Dune Speckled Mug", "one cream speckled stoneware mug with a tapered base and one thick curved handle", 1400, "Speckled stoneware", "W12 × D9 × H10 cm · 350 ml"],
    ["rib-olive-mug", "Rib Olive Mug", "one olive green ceramic mug with fine vertical ribs, a cream glazed interior and one broad curved handle", 2200, "Glazed stoneware", "W12 × D9 × H10 cm · 350 ml"],
    ["tide-cobalt-mug", "Tide Cobalt Mug", "one deep cobalt blue ceramic mug with a glossy rounded body and one large circular handle", 2800, "Glazed stoneware", "W12 × D9 × H10 cm · 350 ml"],
    ["kiln-rust-mug", "Kiln Rust Mug", "one rust red handmade-look ceramic mug with a slightly tapered body, a smooth cream interior and one thick handle", 3600, "Hand-finished stoneware", "W12 × D9 × H10 cm · 350 ml"],
    ["porcelain-ink-mug", "Porcelain Ink Mug", "one elegant white porcelain mug with a fine navy blue rim, a smooth straight body and one slender curved handle", 4800, "Glazed porcelain", "W12 × D9 × H10 cm · 350 ml"],
    ["studio-satin-mug", "Studio Satin Mug", "one satin charcoal ceramic mug with a subtly faceted body, glossy pale interior and one smoothly rounded handle", 6500, "Hand-finished porcelain", "W12 × D9 × H10 cm · 350 ml"],
  ]),
  ...group("vase", "Home accessories", "public/demo/images/ceramic-vase.webp", [
    ["bud-white-vase", "Bud White Vase", "one small opaque white ceramic bud vase with a round belly and a short narrow open neck", 900, "Glazed ceramic", "W12 × D12 × H20 cm"],
    ["terra-round-vase", "Terra Round Vase", "one terracotta ceramic vase with an oval body, a flat base and a short round open neck", 1600, "Unglazed terracotta", "W14 × D14 × H22 cm"],
    ["tube-sage-vase", "Tube Sage Vase", "one sage green ceramic cylindrical vase with straight sides, a flat base and an open round rim", 2400, "Glazed stoneware", "W12 × D12 × H24 cm"],
    ["pebble-sand-vase", "Pebble Sand Vase", "one matte sand ceramic vase with a softly rounded pebble body and a small upright open neck", 3900, "Matte stoneware", "W17 × D14 × H25 cm"],
    ["flute-ivory-vase", "Flute Ivory Vase", "one ivory ceramic vase with gentle vertical fluting, a broad flat base and a tapered round open neck", 5900, "Glazed stoneware", "W16 × D16 × H27 cm"],
    ["arc-blue-vase", "Arc Blue Vase", "one deep blue opaque ceramic vase with a clean sculptural curved body and a single open circular neck", 7900, "Glazed stoneware", "W18 × D14 × H28 cm"],
    ["column-charcoal-vase", "Column Charcoal Vase", "one charcoal stoneware vase with a tall straight cylindrical body, subtle horizontal ridges and an open rim", 10900, "Hand-finished stoneware", "W16 × D16 × H28 cm"],
    ["atelier-chalk-vase", "Atelier Chalk Vase", "one chalk white sculptural ceramic vase with a smooth asymmetrical oval body, flat stable base and a single short open neck", 15900, "Hand-finished porcelain", "W19 × D15 × H28 cm"],
  ]),
  ...group("tote", "Bags", "public/demo/expansion/daily-carry-item-2.webp", [
    ["daily-navy-tote", "Daily Navy Tote", "one upright navy cotton canvas tote bag with two complete short loop handles, a flat base and an unmarked plain front", 1800, "Cotton canvas", "W34 × D10 × H38 cm"],
    ["market-olive-tote", "Market Olive Tote", "one upright olive waxed canvas tote bag with two short tan canvas loop handles, a flat structured base and one plain front pocket", 3900, "Waxed cotton canvas", "W35 × D11 × H38 cm"],
    ["commute-black-tote", "Commute Black Tote", "one upright structured black nylon tote bag with two short rounded black handles, a closed zip top and a simple unmarked front", 6900, "Woven nylon and metal zipper", "W35 × D11 × H37 cm"],
    ["studio-tan-tote", "Studio Tan Tote", "one upright tan leather tote bag with two complete short rounded leather handles, straight sides and a structured flat base", 16900, "Leather and woven lining", "W34 × D11 × H36 cm"],
  ]),
  ...group("handbag", "Bags", "public/demo/expansion/city-style-item-1.webp", [
    ["pocket-sand-bag", "Pocket Sand Bag", "one small structured sand canvas handbag with two short complete rounded handles, a closed zip top and tan base trim", 2900, "Cotton canvas and synthetic trim", "W25 × D10 × H22 cm"],
    ["curve-burgundy-bag", "Curve Burgundy Bag", "one small burgundy synthetic leather top-handle handbag with a curved flap, one complete short arch handle and a small brass clasp", 5900, "Synthetic leather and brass-tone hardware", "W26 × D10 × H22 cm"],
    ["frame-caramel-bag", "Frame Caramel Bag", "one caramel leather structured handbag with two complete short rounded handles, a clean flat front and a closed top zipper", 12900, "Leather, woven lining and metal hardware", "W27 × D10 × H22 cm"],
    ["atelier-black-bag", "Atelier Black Bag", "one premium black pebbled leather top-handle handbag with a structured trapezoid body, one complete short arch handle and a small polished gold clasp", 34900, "Pebbled leather and gold-tone hardware", "W27 × D11 × H23 cm"],
  ]),
  ...group("shoes", "Footwear", "public/demo/expansion/court-white-sneaker.webp", [
    ["daily-canvas-sneaker", "Daily Canvas Sneaker", "one single cream cotton canvas low-top lace-up sneaker with neat simple laces and a solid white rubber sole", 2900, "Cotton canvas and rubber sole", "Size EU 42"],
    ["pace-gray-sneaker", "Pace Gray Sneaker", "one single light gray mesh running sneaker with simple gray laces and a continuous solid white foam sole", 4500, "Mesh textile and foam rubber sole", "Size EU 42"],
    ["weekend-olive-slip-on", "Weekend Olive Slip-On", "one single olive canvas slip-on shoe with elastic side panels, a rounded toe and a solid white rubber sole", 5900, "Cotton canvas and rubber sole", "Size EU 42"],
    ["court-black-sneaker", "Court Black Sneaker", "one single black leather low-top lace-up sneaker with a simple panel construction and a solid off-white rubber cup sole", 8500, "Leather upper and rubber sole", "Size EU 42"],
    ["stride-sand-runner", "Stride Sand Runner", "one single sand and cream suede running sneaker with simple laces, subtle mesh panels and a solid cream foam rubber sole", 11900, "Suede, mesh and foam rubber sole", "Size EU 42"],
    ["heritage-chestnut-derby", "Heritage Chestnut Derby", "one single chestnut leather lace-up derby shoe with a plain rounded toe, neat stitching and a low solid dark brown sole", 14900, "Leather upper and rubber sole", "Size EU 42"],
    ["soft-navy-loafer", "Soft Navy Loafer", "one single navy suede slip-on loafer with a rounded moccasin toe and a continuous thin textured rubber sole", 17900, "Suede upper and rubber sole", "Size EU 42"],
    ["atelier-brown-loafer", "Atelier Brown Loafer", "one single rich dark brown leather penny loafer with a smooth rounded toe, a simple leather saddle and a low solid dark sole", 22900, "Leather upper, leather lining and rubber sole", "Size EU 42"],
  ]),
];
