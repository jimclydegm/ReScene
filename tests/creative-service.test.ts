import {describe,it,expect,vi,beforeEach} from "vitest";
import {randomUUID} from "node:crypto";
const m=vi.hoisted(()=>({db:{scene:{count:vi.fn(),findFirst:vi.fn()},generationRun:{findUnique:vi.fn(),count:vi.fn(),create:vi.fn()},contentItem:{count:vi.fn()},asset:{count:vi.fn()},$executeRaw:vi.fn(),$transaction:vi.fn()},owned:vi.fn()}));
vi.mock("server-only",()=>({}));vi.mock("@/lib/db",()=>({getDb:()=>m.db}));vi.mock("@/lib/services/scenes",()=>({ownedScene:m.owned}));
import {reserveCreative} from "../src/lib/services/creative";
const input=()=>({sceneId:randomUUID(),expectedRevision:0,idempotencyKey:randomUUID(),referenceIds:[randomUUID()],template:"studio",aspect:"1:1",prompt:"A test"});
describe("Creative paid-submission reservation",()=>{
 beforeEach(()=>{vi.resetAllMocks();vi.stubEnv("GENERATION_ENABLED","true");m.owned.mockResolvedValue({status:"DRAFT",settings:{creative:true}});m.db.$transaction.mockImplementation(async f=>f(m.db));m.db.scene.findFirst.mockResolvedValue({id:"scene",revision:0});m.db.generationRun.count.mockResolvedValue(0);m.db.contentItem.count.mockResolvedValue(1);});
 it("returns the same job after JSONB key reordering without making another reservation",async()=>{const v=input(),old=Object.fromEntries(Object.entries(v).reverse());m.db.generationRun.findUnique.mockResolvedValue({id:"prior",kind:"COMPOSE_IMAGE",input:old});expect((await reserveCreative("owner",v)).id).toBe("prior");expect(m.db.generationRun.create).not.toHaveBeenCalled();});
 it("rejects changed settings on an existing idempotency key",async()=>{const v=input();m.db.generationRun.findUnique.mockResolvedValue({kind:"COMPOSE_IMAGE",input:{...v,prompt:"Other"}});await expect(reserveCreative("owner",v)).rejects.toMatchObject({code:"IDEMPOTENCY_CONFLICT"});});
 it("rejects cross-owner/missing reference assets before reserving paid work",async()=>{m.db.contentItem.count.mockResolvedValue(0);await expect(reserveCreative("owner",input())).rejects.toMatchObject({code:"REFERENCE_UNAVAILABLE"});expect(m.db.generationRun.create).not.toHaveBeenCalled();expect(m.db.contentItem.count.mock.calls[0][0].where.OR[0].ownerId).toBe("owner");});
 it("blocks a second active generation and stale revisions",async()=>{m.db.generationRun.count.mockResolvedValue(1);await expect(reserveCreative("owner",input())).rejects.toMatchObject({code:"RUN_ACTIVE"});m.db.generationRun.count.mockResolvedValue(0);m.db.scene.findFirst.mockResolvedValue(null);await expect(reserveCreative("owner",input())).rejects.toMatchObject({code:"REVISION_CONFLICT"});});
});
