import {requirePageUser} from "@/lib/auth/user";
import {StudioHeader} from "@/components/studio-header";
import {NewSceneStart} from "@/components/new-scene-start";
export const dynamic="force-dynamic";
export const metadata={title:"Create a scene"};
export default async function NewScene(){const user=await requirePageUser();return <><StudioHeader name={user.displayName}/><main className="studio-main shell"><NewSceneStart/></main></>;}
