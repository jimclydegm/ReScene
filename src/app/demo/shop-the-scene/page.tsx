import { notFound } from "next/navigation";
import { ShopScenePage } from "@/components/demo/shop-scene";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection = "living" } = await searchParams;
  if (!["corner", "space", "living"].includes(collection)) notFound();
  return <ShopScenePage key={collection} sceneId={collection} />;
}
