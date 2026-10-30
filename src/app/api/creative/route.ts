import {z} from "zod";
import {start} from "workflow/api";
import {api,checkOrigin,readJson,AppError} from "@/lib/http";
import {requireUser} from "@/lib/auth/user";
import {creativeInput,creativeDraftInput} from "@/lib/ai/creative-contract";
import {imageTypes} from "@/lib/validation/scenes";
import {saveCreativeDraft,createCreative,creativeLibrary,creativeUpload,completeCreativeUpload,creativeTemplates,reserveCreative,adoptCreative} from "@/lib/services/creative";
import {createSceneImage} from "@/workflows/creative";
export const maxDuration=60;
const input=z.discriminatedUnion("action",[
 z.object({action:z.literal("CREATE")}).strict(),
 z.object({action:z.literal("UPLOAD"),sceneId:z.uuid(),contentType:z.enum(imageTypes),byteSize:z.number().int().positive().max(12*1024*1024)}).strict(),
 z.object({action:z.literal("COMPLETE"),sceneId:z.uuid(),assetId:z.uuid(),label:z.string().trim().min(1).max(120)}).strict(),
 z.object({action:z.literal("TEMPLATES"),sceneId:z.uuid()}).strict(),
 creativeDraftInput.extend({action:z.literal("SAVE")}),
 creativeInput.extend({action:z.literal("GENERATE")}),
 z.object({action:z.literal("USE"),assetId:z.uuid(),title:z.string().trim().min(1).max(160)}).strict()
]);
export const GET=(req:Request)=>api(async()=>{const user=await requireUser(),url=new URL(req.url),sceneId=z.uuid().optional().parse(url.searchParams.get("sceneId")??undefined),page=z.coerce.number().int().min(0).max(1000).parse(url.searchParams.get("page")??0);return Response.json(await creativeLibrary(user.id,sceneId,page));});
export const POST=(req:Request)=>api(async()=>{
 checkOrigin(req);const user=await requireUser(),v=input.parse(await readJson(req));
 if(v.action==="CREATE"){const scene=await createCreative(user.id);return Response.json({sceneId:scene.id});}
 if(v.action==="UPLOAD")return Response.json(await creativeUpload(user.id,v.sceneId,v.contentType,v.byteSize));
 if(v.action==="COMPLETE"){const asset=await completeCreativeUpload(user.id,v.sceneId,v.assetId,v.label);return Response.json({assetId:asset.id});}
 if(v.action==="TEMPLATES"){await creativeTemplates(user.id,v.sceneId);return Response.json({ok:true});}
 if(v.action==="USE")return Response.json({sceneId:await adoptCreative(user.id,v.assetId,v.title)});
 if(v.action==="SAVE"){const {action:_,...settings}=v;void _;const saved=await saveCreativeDraft(user.id,settings);return Response.json({draftRevision:saved.revision});}
 const {action:_,...settings}=v;void _;const run=await reserveCreative(user.id,settings);
 if(run.status==="QUEUED"){if(run.expiresAt<new Date())throw new AppError(409,"RUN_EXPIRED","This queued request expired. Start a new variation.");try{await start(createSceneImage,[run.id]);}catch{return Response.json({runId:run.id,queued:true},{status:202});}}
 return Response.json({runId:run.id},{status:202});
});
