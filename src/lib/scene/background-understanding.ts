import {z} from "zod";
import type {BackgroundPlan} from "./background";
const color=z.string().regex(/^#[0-9a-fA-F]{6}$/);
const point=z.object({x:z.number().min(0).max(1),y:z.number().min(0).max(1)}).strict();
export const surfaceObservationSchema=z.object({
 visible:z.boolean(),finish:z.enum(["plain","textured"]),color,
 material:z.string().min(1).max(180),roughness:z.number().min(.2).max(1),
 patternScale:z.enum(["fine","medium","coarse"]),
 swatch:z.object({xMin:z.number().min(0).max(1),yMin:z.number().min(0).max(1),xMax:z.number().min(0).max(1),yMax:z.number().min(0).max(1)}).strict().nullable()
}).strict();
export const backgroundUnderstandingSchema=z.object({
 version:z.literal("surface-understanding-v2"),
 topology:z.enum(["open","cyclorama","planes","distant"]),groundVisible:z.boolean(),
 ground:surfaceObservationSchema,wall:surfaceObservationSchema,
 junction:z.object({type:z.enum(["floor-wall","shadow","material-border","uncertain"]),confidence:z.number().min(0).max(1),points:z.array(point).min(2).max(3)}).strict().nullable(),
 lightingEffects:z.array(z.string().max(160)).max(5),
 explanation:z.string().min(1).max(500)
}).strict();
export type BackgroundUnderstanding=z.infer<typeof backgroundUnderstandingSchema>;
// Lighting edges and uncertain borders never create geometry. A curved studio
// sweep is continuous, not a fabricated sharp floor/wall crease.
export function materialBackgroundPlan(understanding:BackgroundUnderstanding):BackgroundPlan{
 const u=backgroundUnderstandingSchema.parse(understanding),junction=u.junction;
 const ordered=junction?.points.every((p,i,points)=>!i||p.x>points[i-1].x+.03);
 const points=u.topology==="planes"&&junction?.type==="floor-wall"&&junction.confidence>=.8&&ordered?junction.points:undefined;
 const continuous=u.wall.visible?u.wall:u.ground;
 const material=(s:typeof u.ground)=>({color:s.color,roughness:s.roughness,tileSize:s.patternScale==="fine"?.5:s.patternScale==="coarse"?2:1});
 return {kind:u.topology==="distant"?"distant":points?"planes":"seamless",groundVisible:u.groundVisible,boundary:null,description:u.explanation,
  ...(u.topology!=="distant"?{surfaceMode:"materials" as const,transition:u.topology==="cyclorama"||u.topology==="planes"&&!points?"curve" as const:"open" as const,
   ...(points?{junctions:points}:{}),materials:{ground:material(u.topology==="cyclorama"?continuous:u.ground),wall:material(u.topology==="cyclorama"?continuous:u.wall)}}:{})};
}
