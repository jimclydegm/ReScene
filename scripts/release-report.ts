import {config} from "dotenv";config({path:".env.local",quiet:true});
import {readFile,writeFile} from "node:fs/promises";
import {getDb} from "../src/lib/db";
const state=JSON.parse(await readFile(process.env.RELEASE_STATE_FILE??"test-results/release-qa.json","utf8"));
const db=getDb();const runs=await db.generationRun.findMany({where:{sceneId:state.sceneId},include:{steps:true},orderBy:{createdAt:"asc"}});
const models=await db.asset.findMany({where:{sceneId:state.sceneId,kind:"MODEL_GLB",status:"READY"},select:{byteSize:true,provenance:true}});
const report={sceneId:state.sceneId,completed:state.completed??false,generatedRuns:runs.map(r=>({kind:r.kind,status:r.status,elapsedSeconds:r.startedAt&&r.completedAt?(r.completedAt.getTime()-r.startedAt.getTime())/1000:null,reservedEstimateUsd:r.reservedCostUsd.toString(),recordedActualUsd:r.actualCostUsd?.toString()??null,steps:r.steps.map(s=>({provider:s.provider,model:s.modelId,status:s.status,recordedCostUsd:s.costUsd?.toString()??null}))})),modelBytes:models.map(m=>m.byteSize),billingNote:"Reserved amounts are estimates; null actual means unknown. Check Meta and fal bills separately.",visualQA:"Pending: local browser access disabled",finishedAt:new Date().toISOString()};
await writeFile("test-results/release-report.json",JSON.stringify(report,null,2),{mode:0o600});console.log(JSON.stringify(report,null,2));process.exit(0);
