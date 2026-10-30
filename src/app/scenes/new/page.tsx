import Link from "next/link";
import {ArrowLeft} from "lucide-react";
import {requirePageUser} from "@/lib/auth/user";
import {StudioHeader} from "@/components/studio-header";
import {NewSceneStart} from "@/components/new-scene-start";
export const dynamic="force-dynamic";
export const metadata={title:"Create a scene"};
export default async function NewScene(){const user=await requirePageUser();return <><StudioHeader name={user.displayName}/><main className="studio-main shell"><Link href="/dashboard" className="back-link"><ArrowLeft size={14}/>Your scenes</Link><NewSceneStart/></main></>;}
