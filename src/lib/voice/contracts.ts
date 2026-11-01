import {z} from "zod";
import {arrangementSchema} from "@/lib/demo/state";
export const voicePurpose=z.enum(["creative","background","analysis","search","showroom"]);
export type VoicePurpose=z.infer<typeof voicePurpose>;
export const voiceLanguage=z.enum(["Auto","English","English + Tagalog","Tagalog","Spanish","French","German","Japanese","Korean","Mandarin Chinese","Hindi","Indonesian","Italian","Portuguese","Arabic","Vietnamese","Thai","Malay","Dutch","Polish","Turkish","Hebrew","Bengali","Marathi","Tamil","Telugu","Kannada"]);
export const voiceUpload=z.object({key:z.uuid(),purpose:voicePurpose,language:voiceLanguage.default("Auto")}).strict();
const nullable=z.string().max(80).nullable();
// Every key is required for Meta strict structured output; irrelevant values are null.
export const voicePlanSchema=z.object({summary:z.string().max(240),actions:z.array(z.object({type:z.enum(["select","color","visible","replace","adjust","lighting","background","shuffle_colors","reset_item"]),target:nullable,productId:nullable,color:z.number().int().min(0).max(15).nullable(),visible:z.boolean().nullable(),dx:z.number().min(-.5).max(.5).nullable(),dz:z.number().min(-.5).max(.5).nullable(),turn:z.number().min(-.52).max(.52).nullable(),lighting:z.enum(["Original","Day","Dusk","Night","Studio"]).nullable(),background:z.enum(["original","linen","clay","sage","gallery","studio"]).nullable()}).strict()).max(6)}).strict();
export type VoicePlan=z.infer<typeof voicePlanSchema>;
export const voiceCommandInput=z.object({attemptId:z.uuid(),text:z.string().trim().min(1).max(1000),sceneId:z.enum(["corner","space","living"]),selected:z.string().max(80),draft:arrangementSchema}).strict();
export type VoiceCommandInput=z.infer<typeof voiceCommandInput>;
export type VoiceResult={attemptId:string;text:string;durationMs:number;model:string};
