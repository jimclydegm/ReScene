import { notFound } from "next/navigation";
import { ProductPage } from "@/components/demo/product";
import { demoProducts, findDemoProduct } from "@/lib/demo/catalog";
export const dynamicParams = false;
export function generateStaticParams() {
  return demoProducts.map((p) => ({ id: p.id }));
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const p = findDemoProduct((await params).id);
  return { title: p ? `${p.name} — ReScene Living` : "Product unavailable" };
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!findDemoProduct(id)) notFound();
  return <ProductPage key={id} id={id} />;
}
