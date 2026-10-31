import { DemoStore } from "@/components/demo/store";
import "./store.css";
import "./shopping.css";
export const metadata = {
  title: "ReScene Living — Interactive shopping demo",
  robots: { index: false, follow: false },
};
export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoStore>{children}</DemoStore>;
}
