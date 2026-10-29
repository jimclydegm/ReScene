import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { requiredEnv } from "@/lib/env";

const globalForDb = globalThis as unknown as { resceneDb?: PrismaClient };

export function getDb(): PrismaClient {
  if (!globalForDb.resceneDb) {
    globalForDb.resceneDb = new PrismaClient({
      adapter: new PrismaNeon({ connectionString: requiredEnv("DATABASE_URL") })
    });
  }
  return globalForDb.resceneDb;
}
