import { NextResponse } from "next/server";
import { db, isDbConfigured } from "@/db";
import { builders } from "@/db/schema";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

// Lightweight health probe — booleans + a count only, no secrets.
export async function GET() {
  let ok = false;
  let builderCount: number | null = null;
  let error: string | null = null;
  try {
    if (isDbConfigured && db) {
      const rows = await db.select({ id: builders.id }).from(builders);
      builderCount = rows.length;
      ok = true;
    }
  } catch (e) {
    console.error("[health]", e);
    error = "database check failed";
  }
  // Booleans only — confirms whether email notifications can send.
  const notify = {
    resendKey: !!process.env.RESEND_API_KEY,
    hasRecipients: !!(process.env.NOTIFY_TO || process.env.ADMIN_EMAILS),
    fromSet: !!process.env.NOTIFY_FROM,
  };

  const blobConfigured = !!process.env.BLOB_READ_WRITE_TOKEN;

  // Public callers get liveness only; config details are for admins.
  const session = await auth();
  const isAdmin = !!(session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;
  if (!isAdmin) return NextResponse.json({ ok });
  return NextResponse.json({ dbConfigured: isDbConfigured, ok, builderCount, error, notify, blobConfigured });
}
