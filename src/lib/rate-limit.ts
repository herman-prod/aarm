import "server-only";
import { sql } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { rateLimits } from "@/db/schema";

/**
 * Fixed-window limiter: allows `limit` hits per `windowSec` for `key`.
 * Throws a user-facing error when exceeded. Fails open if the DB is down so a
 * limiter outage never blocks legitimate use.
 */
export async function rateLimit(key: string, limit: number, windowSec: number) {
  if (!db) return;
  try {
    const rows = await db
      .insert(rateLimits)
      .values({ key, count: 1, windowStart: new Date() })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}) THEN 1 ELSE ${rateLimits.count} + 1 END`,
          windowStart: sql`CASE WHEN ${rateLimits.windowStart} < now() - make_interval(secs => ${windowSec}) THEN now() ELSE ${rateLimits.windowStart} END`,
        },
      })
      .returning({ count: rateLimits.count });
    if ((rows[0]?.count ?? 0) > limit) {
      throw new RateLimitError();
    }
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    console.error("[rate-limit] failing open", e);
  }
}

export class RateLimitError extends Error {
  constructor() {
    super("Too many requests — please wait a bit and try again.");
  }
}

/** Best-effort client IP for unauthenticated limits. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
