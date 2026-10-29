import { api } from "@/lib/http";
import { sharedScene } from "@/lib/services/publication";
export const dynamic="force-dynamic";
export const GET=(_request:Request,context:{params:Promise<{slug:string}>})=>api(async()=>Response.json(await sharedScene((await context.params).slug),{headers:{"Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"}}));
