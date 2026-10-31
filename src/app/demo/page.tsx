import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, Layers3, Move3d, ShoppingBag } from "lucide-react";
export default function DemoHome() {
  const experiences = [
    {
      n: "01",
      href: "/demo/products",
      title: "Explore a product",
      subtitle: "A closer look at every detail",
      text: "Get closer to the texture, turn it around and find your color. Meet the product beyond the photo.",
      image: "corner-chair",
      Icon: Box,
      action: "Shop the collection",
    },
    {
      n: "02",
      href: "/demo/spaces",
      title: "Build your space",
      subtitle: "See how the pieces work together",
      text: "Arrange a collection, try six layouts and see how the colors look in different light.",
      image: "corner",
      Icon: Move3d,
      action: "Choose your collection",
    },
    {
      n: "03",
      href: "/demo/scenes",
      title: "Shop the scene",
      subtitle: "Discover the pieces in the picture",
      text: "Step into a styled scene. Click a piece to discover it, or bring the whole look into your shopping list.",
      image: "living",
      Icon: ShoppingBag,
      action: "Find your room",
    },
  ];
  return (
    <main className="demo-main demo-home">
      <section className="demo-home-intro">
        <span className="d-kicker">ReScene Living · Shopping demo</span>
        <h1>
          See it. Style it. Make it yours.
        </h1>
        <p>
          Photos inspire. A scene lets you explore.
          <br />
          Try three ways to turn a product image into a shopping experience.
        </p>
        <span className="demo-intro-tag">
          <Layers3 size={14} />
          Real saved reconstructions · Powered by Meta AI
        </span>
      </section>
      <section
        className="demo-experience-grid"
        aria-label="Choose a demo experience"
      >
        {experiences.map(
          ({ n, href, title, subtitle, text, image, Icon, action }) => (
            <Link href={href} className="demo-experience" key={n}>
              <div className={`demo-experience-image image-${image}`}>
                <Image
                  src={`/demo/images/${image}.webp`}
                  alt={
                    title === "Explore a product"
                      ? "Sage upholstered lounge chair"
                      : title === "Build your space"
                        ? "Chair, side table and wooden storage collection"
                        : "A styled living room with sofa, coffee table, stool and vase"
                  }
                  width={1000}
                  height={750}
                  priority={n === "01"}
                />
                <span className="demo-experience-number">{n}</span>
                <span className="demo-experience-icon">
                  <Icon size={21} strokeWidth={1.5} />
                </span>
              </div>
              <div className="demo-experience-copy">
                <h2>{title}</h2>
                <h3>{subtitle}</h3>
                <p>{text}</p>
                <span>
                  {action}
                  <ArrowRight size={17} />
                </span>
              </div>
            </Link>
          ),
        )}
      </section>
      <section className="demo-home-note">
        <span className="demo-live-dot" />
        <p>
          Explore freely. These are sample listings with a working demo bag and
          checkout.
          <br />
          <strong>No account, payment or AI generation needed.</strong>
        </p>
      </section>
    </main>
  );
}
