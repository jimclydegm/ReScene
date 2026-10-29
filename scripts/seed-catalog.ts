// Explicit trusted seeding for one authorized scene; original CC0 demo assets only.
import { config } from "dotenv";
config({path:".env.local",quiet:true});
const {getDb}=await import("../src/lib/db");
const {seedCatalog}=await import("../src/lib/services/catalog");
if(!process.env.CATALOG_SCENE_ID)throw new Error("Set CATALOG_SCENE_ID to the authorized scene.");
const scene=await getDb().scene.findUniqueOrThrow({where:{id:process.env.CATALOG_SCENE_ID}});
await seedCatalog(scene.id,scene.ownerId,scene.revision);
console.log("Original demo catalog seeded; no inference.");
process.exit(0);
