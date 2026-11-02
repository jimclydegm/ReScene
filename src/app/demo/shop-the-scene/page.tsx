import { notFound } from "next/navigation";
import { ShopScenePage } from "@/components/demo/shop-scene";
import { collectionIds } from "@/lib/demo/catalog";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection = "living" } = await searchParams;
  if (!collectionIds.includes(collection)) notFound();
  return <ShopScenePage key={collection} sceneId={collection} />;
}
