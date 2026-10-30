import {requirePageUser} from "@/lib/auth/user";
import {StudioHeader} from "@/components/studio-header";
import {CreativeStudio} from "@/components/creative-studio";
export const dynamic="force-dynamic";
export const metadata={title:"Product scene creator"};
export default async function CreateSceneImage({searchParams}:{searchParams:Promise<{workspace?:string}>}){const user=await requirePageUser();return <><StudioHeader name={user.displayName}/><main className="studio-main shell"><CreativeStudio initialSession={(await searchParams).workspace}/></main></>;}
