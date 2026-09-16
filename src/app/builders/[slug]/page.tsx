import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, isDbConfigured } from "@/db";
import { claims } from "@/db/schema";
import { getBuilderBySlug } from "@/lib/builders";
import { ClaimButton } from "@/components/claim-button";
import type { BuilderRow } from "@/db/schema";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBuilderBySlug(slug);
  if (!b) return {};
  return { title: `${b.name} — AARM Builder`, description: b.tagline ?? b.description ?? undefined };
}

function faviconUrl(domain?: string | null) {
  return `https://www.google.com/s2/favicons?domain=${domain ?? ""}&sz=64`;
}

/** Renders a value or a muted blank placeholder. */
function Val({ children }: { children?: React.ReactNode }) {
  const empty = children == null || children === "" || (Array.isArray(children) && children.length === 0);
  if (empty) return <span className="text-neutral-300">Not provided yet</span>;
  return <>{children}</>;
}

function Chips({ items }: { items?: string[] | null }) {
  if (!items || items.length === 0) return <span className="text-neutral-300">Not provided yet</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((i) => (
        <span key={i} className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-xs text-neutral-600">
          {i}
        </span>
      ))}
    </div>
  );
}

const ALL_REQS = [
  { id: "R1", title: "Pre-execution interception", level: "MUST" },
  { id: "R2", title: "Context accumulation", level: "MUST" },
  { id: "R3", title: "Policy evaluation with intent alignment", level: "MUST" },
  { id: "R4", title: "Five authorization decisions", level: "MUST" },
  { id: "R5", title: "Tamper-evident receipts", level: "MUST" },
  { id: "R6", title: "Identity binding", level: "MUST" },
  { id: "R7", title: "Semantic distance tracking", level: "SHOULD" },
  { id: "R8", title: "Telemetry export", level: "SHOULD" },
  { id: "R9", title: "Least privilege enforcement", level: "SHOULD" },
];

function completeness(b: BuilderRow) {
  const checks: [string, boolean][] = [
    ["Surfaces", (b.surfaces?.length ?? 0) > 0],
    ["Stage", !!b.stage],
    ["Type", (b.types?.length ?? 0) > 0],
    ["Audience", (b.audiences?.length ?? 0) > 0],
    ["Point of contact", !!b.pocEmail],
  ];
  return checks.filter(([, ok]) => !ok).map(([label]) => label);
}

export default async function BuilderDetailPage({ params }: Props) {
  const { slug } = await params;
  const b = await getBuilderBySlug(slug);
  if (!b) notFound();

  const session = await auth();
  const isAuthed = !!session?.user?.id;
  const isOwner = isAuthed && b.claimedBy === session!.user!.id;
  const isAdmin = !!(session?.user as { isAdmin?: boolean } | undefined)?.isAdmin;
  const isTeam = isOwner || isAdmin;
  const claimedByOther = !!b.claimedBy && b.claimedBy !== session?.user?.id;

  // Does the signed-in user already have a pending claim on this listing?
  const userId = session?.user?.id;
  let hasPendingClaim = false;
  if (userId && !isOwner && isDbConfigured && db) {
    const existing = await db
      .select({ id: claims.id })
      .from(claims)
      .where(
        and(eq(claims.builderId, b.id), eq(claims.userId, userId), eq(claims.status, "pending"))
      )
      .limit(1);
    hasPendingClaim = existing.length > 0;
  }

  const isExtended = b.conformanceLevel === "extended";
  const isCore = b.conformanceLevel === "core";
  const verified = isExtended || isCore;
  const missing = completeness(b);

  return (
    <div className="bg-white">
      {/* Header */}
      <section className="border-b border-blue-100" style={{ backgroundColor: "#EEF4FF" }}>
        <div className="mx-auto max-w-4xl px-6 py-14">
          <Link href="/builders" className="mb-8 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800">
            ← Builder Registry
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.logoUrl || faviconUrl(b.domain)} alt="" width={32} height={32} className="rounded-sm" />
            </div>
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">{b.name}</h1>
                {verified ? (
                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${isExtended ? "border-blue-200 bg-blue-50 text-blue-700" : "border-green-200 bg-green-50 text-green-700"}`}>
                    {isExtended ? "AARM Extended" : "AARM Core"}
                  </span>
                ) : (
                  <span className="rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    Aligned
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500"><Val>{b.tagline || b.description}</Val></p>
              {b.website && (
                <a href={/^https?:\/\//i.test(b.website) ? b.website : `https://${b.website}`} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70" style={{ color: "#1A6EB5" }}>
                  {b.domain} ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-4xl px-6 py-14">
        {/* Team-only: missing-data flag */}
        {isTeam && missing.length > 0 && (
          <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
            <p className="text-sm font-semibold text-amber-800">Missing data ({missing.length})</p>
            <p className="mt-1 text-sm text-amber-700">{missing.join(" · ")}</p>
          </div>
        )}

        {/* Overview */}
        {b.about && (
          <section className="mb-14">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-neutral-400">Overview</h2>
            <p className="leading-relaxed text-neutral-600">{b.about}</p>
          </section>
        )}

        {/* Classification */}
        <section className="mb-14">
          <h2 className="mb-5 font-mono text-xs uppercase tracking-widest text-neutral-400">Classification</h2>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Row label="Coverage surface"><Chips items={b.surfaces} /></Row>
            <Row label="Stage"><Val>{b.stage}</Val></Row>
            <Row label="Type"><Chips items={b.types} /></Row>
            <Row label="Target audience"><Chips items={b.audiences} /></Row>
            <Row label="Deployment"><Chips items={b.deployments} /></Row>
          </dl>
        </section>

        {/* Technical (spec-grounded, TWG-verified) */}
        <section className="mb-14">
          <h2 className="mb-1 font-mono text-xs uppercase tracking-widest text-neutral-400">Technical profile</h2>
          <p className="mb-5 text-xs text-neutral-400">Spec-grounded axes, verified by the TWG.</p>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <Row label="Interception architecture (R1)"><Chips items={b.interception} /></Row>
            <Row label="Policy model (R3)"><Val>{b.policyModel}</Val></Row>
            <Row label="Authorization decisions (R4)"><Chips items={b.decisions} /></Row>
            <Row label="Conformance level"><Val>{verified ? (isExtended ? "Extended (R1–R9)" : "Core (R1–R6)") : "Aligned"}</Val></Row>
          </dl>
        </section>

        {/* Conformance review (verified only) */}
        {verified && (b.requirements?.length ?? 0) > 0 && (
          <section className="mb-14">
            <h2 className="mb-5 font-mono text-xs uppercase tracking-widest text-neutral-400">Conformance review</h2>

            {/* Record metadata */}
            <div className="mb-6 grid gap-2 text-sm sm:grid-cols-2">
              {[
                { label: "Specification version", value: "AARM v1.0" },
                { label: "Conformance tier", value: isExtended ? "Extended (R1–R9)" : "Core (R1–R6)" },
                { label: "Verified by", value: b.verifiedBy ?? "Herman Errico, AARM Author" },
                { label: "Date", value: b.verifiedDate ?? "—" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between rounded-lg border border-neutral-100 bg-neutral-50 px-4 py-2.5">
                  <span className="text-neutral-400">{row.label}</span>
                  <span className="font-medium text-neutral-700">{row.value}</span>
                </div>
              ))}
            </div>

            <div className="overflow-hidden rounded-xl border border-neutral-100">
              <table className="w-full text-sm">
                <tbody>
                  {ALL_REQS.map((req) => {
                    const m = b.requirements?.find((r) => r.id === req.id);
                    const status = m?.status ?? "na";
                    return (
                      <tr key={req.id} className="border-b border-neutral-50 last:border-0">
                        <td className="px-4 py-3">
                          <code className="rounded px-1.5 py-0.5 font-mono text-xs font-bold" style={req.level === "MUST" ? { backgroundColor: "rgba(26,110,181,0.08)", color: "#1A6EB5" } : { backgroundColor: "rgba(107,114,128,0.08)", color: "#6B7280" }}>{req.id}</code>
                        </td>
                        <td className="px-4 py-3 text-neutral-700">
                          {req.title}{m?.notes && <span className="ml-1.5 text-xs text-neutral-400">— {m.notes}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {status === "pass" && <span className="text-green-600">✅</span>}
                          {status === "fail" && <span className="text-red-500">❌</span>}
                          {status === "na" && <span className="text-neutral-300">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Capabilities */}
        {(b.capabilities?.length ?? 0) > 0 && (
          <section className="mb-14">
            <h2 className="mb-5 font-mono text-xs uppercase tracking-widest text-neutral-400">Platform capabilities</h2>
            <ul className="space-y-2">
              {b.capabilities!.map((cap) => (
                <li key={cap} className="flex items-start gap-2.5 text-sm text-neutral-600">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#1A6EB5" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {cap}
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Architecture */}
        {b.architecture && (
          <section className="mb-14">
            <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-neutral-400">Architecture</h2>
            <p className="leading-relaxed text-neutral-600">{b.architecture}</p>
          </section>
        )}

        {/* Key facts */}
        {(b.keyFacts?.length ?? 0) > 0 && (
          <section className="mb-14">
            <h2 className="mb-5 font-mono text-xs uppercase tracking-widest text-neutral-400">Key facts</h2>
            <div className="overflow-hidden rounded-xl border border-neutral-100">
              <table className="w-full text-sm">
                <tbody>
                  {b.keyFacts!.map((f, i) => (
                    <tr key={f.label} className={i < b.keyFacts!.length - 1 ? "border-b border-neutral-50" : ""}>
                      <td className="w-40 px-4 py-3 text-neutral-400">{f.label}</td>
                      <td className="px-4 py-3 font-medium text-neutral-700">{f.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Point of contact — team only */}
        {isTeam && (
          <section className="mb-14">
            <h2 className="mb-5 font-mono text-xs uppercase tracking-widest text-neutral-400">Point of contact <span className="text-neutral-300">(team-only)</span></h2>
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <Row label="Name"><Val>{b.pocName}</Val></Row>
              <Row label="Email"><Val>{b.pocEmail}</Val></Row>
            </dl>
          </section>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-100 pt-8">
          <p className="text-xs text-neutral-400">
            {claimedByOther && !isAdmin
              ? `Maintained by the ${b.name} team.`
              : isOwner
              ? "You maintain this listing."
              : "Listed in the AARM registry."}
            {verified && " Conformance verified by the AARM working group."}
          </p>
          <ClaimButton
            builderId={b.id}
            isAuthed={isAuthed}
            isOwner={isOwner || isAdmin}
            claimedByOther={claimedByOther && !isAdmin}
            hasPendingClaim={hasPendingClaim}
            slug={b.slug}
          />
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-sm text-neutral-700">{children}</dd>
    </div>
  );
}
