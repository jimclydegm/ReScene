import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Box, Layers3, Move3d, ShoppingBag } from "lucide-react";
export default function DemoHome() {
  const experiences = [
    {
      n: "01",
      href: "/demo/product/sage-chair",
      title: "Explore a product",
      subtitle: "Every angle. One place.",
      text: "Get closer to the texture, turn it around and find your color. Meet the product beyond the photo.",
      image: "sage-chair",
      Icon: Box,
      action: "Meet the Sage chair",
    },
    {
      n: "02",
      href: "/demo/space",
      title: "Build your space",
      subtitle: "Find what feels right together.",
      text: "Arrange a collection, compare two layouts and see it in a different light. Your space, at your pace.",
      image: "space",
      Icon: Move3d,
      action: "Make room for your ideas",
    },
    {
      n: "03",
      href: "/demo/shop-the-scene",
      title: "Shop the scene",
      subtitle: "Love the room? Meet the pieces.",
      text: "Step into a styled scene. Click a piece to discover it, or bring the whole look into your shopping list.",
      image: "living",
      Icon: ShoppingBag,
      action: "Explore the Sunday room",
    },
  ];
  return (
    <main className="demo-main demo-home">
      <section className="demo-home-intro">
        <span className="d-kicker">WELCOME TO RESCENE LIVING</span>
        <h1>
          A new perspective
          <br />
          on finding your favorites.
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
