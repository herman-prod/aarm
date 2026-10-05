import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { isDbConfigured } from "@/db";
import { getSpeakerProfile, getMyPaper, getMyPaperReviews } from "@/lib/actions";
import { CfpForm } from "@/components/cfp-form";

export const metadata: Metadata = { title: "Submit a paper — INTERCEPT" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Pending review", cls: "text-[#FF7A00] border-[#FF7A00]" },
  under_review: { label: "Under review", cls: "text-[#2EFF7B] border-[#2EFF7B]" },
  accepted: { label: "Accepted", cls: "text-[#2EFF7B] border-[#2EFF7B]" },
  rejected: { label: "Not selected", cls: "text-[#FF3B30] border-[#FF3B30]" },
};

export default async function CfpPage() {
  if (!isDbConfigured) {
    return <div className="min-h-screen bg-[#0A0A0A] px-6 py-24 text-center font-mono text-sm text-neutral-500">Submissions open once the database is provisioned.</div>;
  }
  const session = await auth();
  if (!session?.user?.id) redirect("/intercept/profile");

  const profile = await getSpeakerProfile();
  if (!profile) redirect("/intercept/profile"); // must create a profile first

  const paper = await getMyPaper();
  const status = paper ? STATUS[paper.status] ?? STATUS.pending : null;
  const decided = paper?.status === "accepted" || paper?.status === "rejected";
  const { reviews } = decided ? await getMyPaperReviews() : { reviews: [] };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-neutral-200" style={{ fontFamily: "ui-monospace,SFMono-Regular,Menlo,monospace" }}>
      <div className="mx-auto max-w-3xl px-6 py-14">
        <nav className="mb-8 font-mono text-xs uppercase tracking-widest text-neutral-500">
          <Link href="/intercept" className="hover:text-white">INTERCEPT</Link>
          <span className="mx-2 text-neutral-700">/</span>
          <Link href="/intercept/profile" className="hover:text-white">Profile</Link>
          <span className="mx-2 text-neutral-700">/</span>
          <span className="text-neutral-300">{paper ? "Your submission" : "Submit a paper"}</span>
        </nav>

        {/* Status above */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <h1 className="text-white" style={{ fontSize: "1.8rem", fontWeight: 800, letterSpacing: "2px" }}>{paper ? "YOUR SUBMISSION" : "SUBMIT A PAPER"}</h1>
          {status && <span className={`border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-widest ${status.cls}`}>{status.label}</span>}
        </div>

        {/* Anonymize banner — while composing or revising a submission */}
        {!decided && (
          <div className="mb-8 space-y-3">
            <div className="border-l-2 border-[#FF3B30] bg-[#FF3B30]/10 px-4 py-3">
              <p className="font-mono text-sm text-[#FFB4AE]">
                <span className="font-bold text-[#FF3B30]">Blind review:</span> do <strong>not</strong> include your
                name or company name anywhere — in the talk title, the sections, or the paper.
                A paper with a reference to an author or company <strong>will be deleted</strong>.
              </p>
            </div>
            <div className="border-l-2 border-[#FF7A00] bg-[#FF7A00]/10 px-4 py-3">
              <p className="font-mono text-sm text-[#FFD9B0]">
                <span className="font-bold text-[#FF7A00]">Required format:</span> submit your paper as an IEEE
                conference paper using the{" "}
                <a href="https://www.overleaf.com/latex/templates/ieee-conference-template/grfzhhncsfqn" target="_blank" rel="noopener noreferrer" className="underline">
                  Overleaf IEEE conference template ↗
                </a>, exported to PDF.
              </p>
            </div>
          </div>
        )}

        {/* Decided → locked read-only view. Otherwise an editable form (new or resubmit). */}
        {decided ? (
          <div className="mb-10 space-y-6">
            <div className="border border-neutral-800 bg-neutral-950 p-5 font-mono text-sm text-neutral-400">
              Submitted as <span className="text-white">Paper #{paper!.number}</span> — a decision has been made, so it&apos;s now locked.
            </div>
            <div className="space-y-5">
              {([["Title of talk", paper!.title], ["Core topics", paper!.coreTopics], ["Key takeaways", paper!.keyTakeaways], ["Why it matters & who it's for", paper!.relevance]] as const).map(([lab, val]) => (
                <div key={lab} className="border border-neutral-800 bg-neutral-950 p-5">
                  <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">{lab}</div>
                  <p className="whitespace-pre-wrap font-mono text-sm text-neutral-200">{val || "—"}</p>
                </div>
              ))}
              {paper!.fileName && (
                <div className="font-mono text-xs text-neutral-500">
                  Attached: {paper!.fileUrl ? <a href={`/api/intercept/paper?id=${paper!.id}`} target="_blank" rel="noopener noreferrer" className="text-[#2EFF7B] underline">{paper!.fileName} ↗</a> : paper!.fileName}
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {paper && (
              <div className="mb-6 border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm text-neutral-400">
                This is <span className="text-white">Paper #{paper.number}</span>. You can revise and resubmit any time before submissions close on December 31, 2026 — resubmitting puts it back into the review queue.
              </div>
            )}
            <CfpForm paper={paper} />
          </>
        )}

        {/* Reviewer feedback — shown once a decision is made (blind) */}
        {decided && (
          <div className="mb-10">
            <div className="mb-4 border p-5 font-mono text-sm" style={{ borderColor: paper!.status === "accepted" ? "#2EFF7B" : "#FF3B30" }}>
              <span className={paper!.status === "accepted" ? "text-[#2EFF7B]" : "text-[#FF3B30]"}>
                {paper!.status === "accepted" ? "Accepted" : "Not selected"}
              </span>
              <span className="text-neutral-400"> — Paper #{paper!.number}. {reviews.length} blind review{reviews.length === 1 ? "" : "s"} below.</span>
            </div>
            <div className="space-y-4">
              {reviews.map((r, i) => (
                <div key={i} className="border border-neutral-800 bg-neutral-950 p-5">
                  <div className="mb-3 font-mono text-xs uppercase tracking-[0.25em] text-[#FF7A00]">Evaluator {i + 1}</div>
                  <div className="space-y-2 font-mono text-sm">
                    {([["Core topics", r.scoreCore, r.commentCore], ["Key takeaways", r.scoreTakeaways, r.commentTakeaways], ["Why it matters", r.scoreRelevance, r.commentRelevance]] as const).map(([lab, sc, cm], j) => (
                      <div key={j}>
                        <span className="text-neutral-500">{lab}: </span>
                        <span className="text-white">{sc != null ? `${sc}/10` : "—"}</span>
                        {cm ? <div className="mt-0.5 text-neutral-400">{cm}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {reviews.length === 0 && <p className="font-mono text-sm text-neutral-600">No written feedback was recorded.</p>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
