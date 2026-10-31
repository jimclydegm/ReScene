import { notFound } from "next/navigation";
import { SpacePage } from "@/components/demo/space";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ collection?: string }>;
}) {
  const { collection = "corner" } = await searchParams;
  if (!["corner", "space"].includes(collection)) notFound();
  return <SpacePage key={collection} sceneId={collection} />;
}
