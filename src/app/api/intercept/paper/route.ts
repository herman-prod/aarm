import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { get } from "@vercel/blob";
import { auth } from "@/auth";
import { db } from "@/db";
import { papers, paperAssignments } from "@/db/schema";
import { isOwnPaperBlob } from "@/lib/paper-blob";

export const runtime = "nodejs";
export const maxDuration = 30;

// Streams a CFP paper PDF from the private Blob store. Papers are never served
// via a public URL — access is gated here to the author, evaluators, and chairs
// so blind review stays sealed.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const user = session?.user as
      | { id?: string; isAdmin?: boolean; isChair?: boolean; isEvaluator?: boolean }
      | undefined;
    if (!user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!db) return NextResponse.json({ error: "Not configured." }, { status: 503 });

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing paper id." }, { status: 400 });

    const [paper] = await db.select().from(papers).where(eq(papers.id, id)).limit(1);
    if (!paper) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const isAuthor = paper.userId === user.id;
    const canReview = Boolean(user.isAdmin || user.isChair || user.isEvaluator);
    if (!isAuthor && !canReview) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    // Plain evaluators only see papers they're assigned to (when assignments exist).
    if (!isAuthor && !user.isAdmin && !user.isChair) {
      const assigned = await db
        .select({ evaluatorId: paperAssignments.evaluatorId })
        .from(paperAssignments)
        .where(eq(paperAssignments.paperId, paper.id));
      if (assigned.length > 0 && !assigned.some((a) => a.evaluatorId === user.id)) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 });
      }
    }

    if (!paper.fileUrl) return NextResponse.json({ error: "No file attached." }, { status: 404 });
    // Defense in depth: never stream a blob outside the author's upload prefix.
    if (!isOwnPaperBlob(paper.fileUrl, paper.userId)) {
      return NextResponse.json({ error: "File unavailable." }, { status: 404 });
    }

    const result = await get(paper.fileUrl, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return NextResponse.json({ error: "File unavailable." }, { status: 404 });
    }

    const filename = (paper.fileName || `paper-${paper.number}.pdf`).replace(/[^a-zA-Z0-9._-]/g, "_");
    return new NextResponse(result.stream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[intercept paper]", e);
    return NextResponse.json({ error: "Failed to load the paper." }, { status: 500 });
  }
}
