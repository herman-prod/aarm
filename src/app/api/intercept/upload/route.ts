import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";
import { rateLimit, RateLimitError } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 30;

// Uploads a CFP paper (PDF) to Vercel Blob. Kept simple + server-side; returns
// the real error so failures are diagnosable. Cap fits the serverless body
// limit (~4.5MB) — plenty for an IEEE conference paper.
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json({ error: "File upload isn't configured (no Blob store)." }, { status: 503 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file received." }, { status: 400 });
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      return NextResponse.json({ error: "PDF files only." }, { status: 400 });
    }
    if (file.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Keep the PDF under 4MB." }, { status: 400 });
    }
    // Extension and MIME type are client-controlled; check the file really is a PDF.
    const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
    if (String.fromCharCode(...head) !== "%PDF-") {
      return NextResponse.json({ error: "That file isn't a valid PDF." }, { status: 400 });
    }
    await rateLimit(`upload:${session.user.id}`, 20, 3600);

    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    // Store is private: papers stay gated behind auth and are served through
    // /api/intercept/paper, never via a public URL.
    const blob = await put(`intercept-papers/${session.user.id}/${Date.now()}-${safe}`, file, {
      access: "private",
      contentType: "application/pdf",
    });
    return NextResponse.json({ url: blob.url, name: file.name });
  } catch (e) {
    if (e instanceof RateLimitError) return NextResponse.json({ error: e.message }, { status: 429 });
    console.error("[intercept upload]", e);
    return NextResponse.json({ error: "Upload failed — please try again." }, { status: 500 });
  }
}
