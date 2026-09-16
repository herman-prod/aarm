import type { Metadata } from "next";
import Link from "next/link";
import { BuilderRegistry } from "@/components/builder-registry";
import { getApprovedBuilders } from "@/lib/builders";

export const metadata: Metadata = {
  title: "Builder Registry — AARM",
  description: "Companies building AARM-conformant and AARM-aligned AI agent runtime security products.",
};

// Read the live DB on each request so profile edits show immediately.
export const dynamic = "force-dynamic";

export default async function BuildersPage() {
  const builders = await getApprovedBuilders();
  const conformant = builders.filter((b) => b.conformanceLevel === "core" || b.conformanceLevel === "extended").length;

  return (
    <div>
      {/* Hero */}
      <section className="border-b border-blue-100" style={{ backgroundColor: "#EEF4FF" }}>
        <div className="mx-auto max-w-5xl px-6 py-14">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest" style={{ color: "#1A6EB5" }}>Builder Registry</p>
          <h1 className="mb-4 max-w-3xl text-3xl font-extrabold tracking-tight text-neutral-900 sm:text-4xl">
            Who&apos;s building AI agent runtime security
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-neutral-500">
            Compare the products tackling the agentic runtime security problem — by conformance, policy model,
            interception architecture, and coverage.
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <Stat value={builders.length} label="Companies" />
              <Stat value={conformant} label="AARM conformant" accent />
            </div>
            <Link href="/builders/new" className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#1A6EB5] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 sm:w-auto">
              Add your company →
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* Legend */}
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-neutral-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full border border-green-600/25 bg-green-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-green-800">Core</span>
            <span className="rounded-full border border-[#1A6EB5]/25 bg-[#EEF4FF] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[#155A96]">Extended</span>
            satisfy AARM requirements (R1–R6 / R1–R9) ·{" "}
            <Link href="/conformance" className="font-medium" style={{ color: "#1A6EB5" }}>get verified →</Link>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-neutral-500">Aligned</span>
            building in the same space
          </span>
        </div>

        <BuilderRegistry builders={builders} />
      </div>
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/70 bg-white/70 px-4 py-2.5 shadow-sm backdrop-blur-sm">
      <div className="text-xl font-extrabold tracking-tight" style={{ color: accent ? "#1A6EB5" : "#0B1E35" }}>{value}</div>
      <div className="font-mono text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
    </div>
  );
}
