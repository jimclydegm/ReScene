import { notFound } from "next/navigation";
import { AppError } from "@/lib/http";
import { sharedScene } from "@/lib/services/publication";
import { SharedViewer } from "@/components/scene/shared-viewer";
export const dynamic="force-dynamic";
export const metadata={title:"Explore this scene",robots:{index:false,follow:false},referrer:"no-referrer" as const};
export default async function SharedPage({params}:{params:Promise<{slug:string}>}){
 const {slug}=await params;
 const scene=await sharedScene(slug).catch(error=>{if(error instanceof AppError&&error.status===404)notFound();throw error;});
 return <SharedViewer initial={scene} slug={slug}/>;
}
