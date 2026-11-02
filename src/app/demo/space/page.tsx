import { notFound } from "next/navigation";
import { SpacePage } from "@/components/demo/space";
import { collectionIds } from "@/lib/demo/catalog";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection = "corner" } = await searchParams;
  if (!collectionIds.includes(collection)) notFound();
  return <SpacePage key={collection} sceneId={collection} />;
}
