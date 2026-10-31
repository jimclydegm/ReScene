import { sampleImagePath, settingImagePath } from "@/lib/ai/sample-products";
export const productInspiration = [
  ["black-dining-chair", "Black dining chair"],
  ["white-shell-chair", "Shell chair"],
  ["writing-desk", "Writing desk"],
  ["dome-desk-lamp", "Desk lamp"],
  ["travel-tumbler", "Travel tumbler"],
  ["navy-bottle", "Water bottle"],
  ["ceramic-canister", "Ceramic canister"],
  ["metal-storage-tin", "Storage tin"],
].map(([id, title]) => ({ id, title, path: sampleImagePath(id)! }));
export const sceneInspiration = [
  ["graphite-desk-wide", "Sleek gray desk"],
  ["walnut-table-wide", "Walnut table"],
  ["bedroom-wide", "Calm bedroom"],
  ["kitchen-wide", "Bright kitchen"],
].map(([id, title]) => ({ id, title, path: settingImagePath(id) }));
