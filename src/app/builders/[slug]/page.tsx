import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, isDbConfigured } from "@/db";
import { claims } from "@/db/schema";
import { getBuilderBySlug } from "@/lib/builders";
import { ClaimButton } from "@/components/claim-button";
import { BuilderLogo } from "@/components/builder-logo";
import type { BuilderRow } from "@/db/schema";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const b = await getBuilderBySlug(slug);
  if (!b) return {};
  return { title: `${b.name} — AARM Builder`, description: b.tagline ?? b.description ?? undefined };
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

  const hasClassification =
    (b.surfaces?.length ?? 0) > 0 || !!b.stage || (b.types?.length ?? 0) > 0 ||
    (b.audiences?.length ?? 0) > 0 || (b.deployments?.length ?? 0) > 0;
  const hasTechnical = (b.interception?.length ?? 0) > 0 || !!b.policyModel || (b.decisions?.length ?? 0) > 0;
  const hasReview = verified && (b.requirements?.length ?? 0) > 0;
  const hasBody =
    !!b.about || hasClassification || hasTechnical || hasReview ||
    (b.capabilities?.length ?? 0) > 0 || !!b.architecture;

  return (
    <div className="bg-white">
      {/* Header */}
      <section className="border-b border-blue-100" style={{ backgroundColor: "#EEF4FF" }}>
        <div className="mx-auto max-w-5xl px-6 py-14">
          <Link href="/builders" className="mb-8 inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 transition-colors hover:text-neutral-800">
            ← Builder Registry
          </Link>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <BuilderLogo name={b.name} domain={b.domain} logoUrl={b.logoUrl} imgSize={30} className="h-14 w-14 shrink-0 rounded-2xl border border-neutral-200 bg-white shadow-sm" />
              <div className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-extrabold tracking-tight text-neutral-900">{b.name}</h1>
                  {verified ? (
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide ${isExtended ? "border-[#1A6EB5]/25 bg-white text-[#155A96]" : "border-green-600/25 bg-white text-green-800"}`}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: isExtended ? "#1A6EB5" : "#16A34A" }} />
                      {isExtended ? "AARM Extended" : "AARM Core"}
                    </span>
                  ) : (
                    <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      Aligned
                    </span>
                  )}
                </div>
                <p className="max-w-xl text-sm leading-relaxed text-neutral-600"><Val>{b.tagline || b.description}</Val></p>
              </div>
            </div>
            {b.website && (
              <a
                href={/^https?:\/\//i.test(b.website) ? b.website : `https://${b.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-xl border border-[#1A6EB5]/30 bg-white px-4 py-2 text-sm font-semibold text-[#1A6EB5] shadow-sm transition-colors hover:bg-[#1A6EB5] hover:text-white sm:self-center"
              >
                Visit website ↗
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-5xl gap-10 px-6 py-14 lg:grid-cols-[1fr_320px]">
        {/* ── Main column ── */}
        <div className="min-w-0">
          {/* Team-only: missing-data flag */}
          {isTeam && missing.length > 0 && (
            <div className="mb-10 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
              <p className="text-sm font-semibold text-amber-800">Missing data ({missing.length})</p>
              <p className="mt-1 text-sm text-amber-700">{missing.join(" · ")}</p>
            </div>
          )}

          {/* Limited profile — when there's essentially nothing to show */}
          {!hasBody && (
            <div className="mb-4 rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 px-6 py-10 text-center">
              <p className="text-sm font-medium text-neutral-600">This is a limited profile.</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-400">
                {b.name} is listed as building in the agentic runtime security space. Details will appear once the team
                claims and completes their listing.
              </p>
            </div>
          )}

          {/* Overview */}
          {b.about && (
            <Block title="Overview">
              <p className="leading-relaxed text-neutral-600">{b.about}</p>
            </Block>
          )}

          {/* Classification */}
          {hasClassification && (
            <Block title="Classification">
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {(b.surfaces?.length ?? 0) > 0 && <Row label="Coverage surface"><Chips items={b.surfaces} /></Row>}
                {b.stage && <Row label="Stage">{b.stage}</Row>}
                {(b.types?.length ?? 0) > 0 && <Row label="Type"><Chips items={b.types} /></Row>}
                {(b.audiences?.length ?? 0) > 0 && <Row label="Target audience"><Chips items={b.audiences} /></Row>}
                {(b.deployments?.length ?? 0) > 0 && <Row label="Deployment"><Chips items={b.deployments} /></Row>}
              </dl>
            </Block>
          )}

          {/* Technical (spec-grounded, TWG-verified) */}
          {hasTechnical && (
            <Block title="Technical profile" note="Spec-grounded axes, verified by the TWG.">
              <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                {(b.interception?.length ?? 0) > 0 && <Row label="Interception architecture (R1)"><Chips items={b.interception} /></Row>}
                {b.policyModel && <Row label="Policy model (R3)">{b.policyModel}</Row>}
                {(b.decisions?.length ?? 0) > 0 && <Row label="Authorization decisions (R4)"><Chips items={b.decisions} /></Row>}
              </dl>
            </Block>
          )}

          {/* Conformance review (verified only) */}
          {hasReview && (
            <Block title="Conformance review">
              <div className="overflow-hidden rounded-xl border border-neutral-200">
                <table className="w-full text-sm">
                  <tbody>
                    {ALL_REQS.map((req) => {
                      const m = b.requirements?.find((r) => r.id === req.id);
                      const status = m?.status ?? "na";
                      return (
                        <tr key={req.id} className="border-b border-neutral-100 last:border-0">
                          <td className="px-4 py-3 align-top">
                            <code className="rounded px-1.5 py-0.5 font-mono text-xs font-bold" style={req.level === "MUST" ? { backgroundColor: "rgba(26,110,181,0.08)", color: "#1A6EB5" } : { backgroundColor: "rgba(107,114,128,0.08)", color: "#6B7280" }}>{req.id}</code>
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {req.title}{m?.notes && <span className="ml-1.5 text-xs text-neutral-400">— {m.notes}</span>}
                          </td>
                          <td className="px-4 py-3 text-right"><StatusPill status={status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Block>
          )}

          {/* Capabilities */}
          {(b.capabilities?.length ?? 0) > 0 && (
            <Block title="Platform capabilities">
              <ul className="space-y-2.5">
                {b.capabilities!.map((cap) => (
                  <li key={cap} className="flex items-start gap-2.5 text-sm leading-relaxed text-neutral-600">
                    <svg className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#1A6EB5" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {cap}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {/* Architecture */}
          {b.architecture && (
            <Block title="Architecture">
              <p className="whitespace-pre-line leading-relaxed text-neutral-600">{b.architecture}</p>
            </Block>
          )}
        </div>

        {/* ── Sticky sidebar ── */}
        <aside className="h-max space-y-4 lg:sticky lg:top-6">
          {/* Conformance card */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Conformance</div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-extrabold tracking-tight" style={{ color: verified ? "#1A6EB5" : "#525252" }}>
                {verified ? (isExtended ? "Extended" : "Core") : "Aligned"}
              </span>
              <span className="text-xs text-neutral-400">{verified ? (isExtended ? "R1–R9" : "R1–R6") : "in the space"}</span>
            </div>
            {verified ? (
              <dl className="mt-4 space-y-2 border-t border-neutral-100 pt-4 text-sm">
                {[
                  ["Spec", "AARM v1.0"],
                  ["Verified by", b.verifiedBy ?? "AARM working group"],
                  ["Date", b.verifiedDate ?? "—"],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-3">
                    <dt className="text-neutral-400">{k}</dt>
                    <dd className="text-right font-medium text-neutral-700">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                Building in the agentic runtime security space.{" "}
                <Link href="/conformance" className="font-medium" style={{ color: "#1A6EB5" }}>Get verified →</Link>
              </p>
            )}
          </div>

          {/* Key facts */}
          {(b.keyFacts?.length ?? 0) > 0 && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Key facts</div>
              <dl className="space-y-2.5 text-sm">
                {b.keyFacts!.map((f) => (
                  <div key={f.label}>
                    <dt className="text-xs text-neutral-400">{f.label}</dt>
                    <dd className="font-medium text-neutral-800">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Point of contact — team only */}
          {isTeam && (
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="mb-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400">
                Point of contact <span className="text-neutral-300">· team-only</span>
              </div>
              <dl className="space-y-2.5 text-sm">
                <div><dt className="text-xs text-neutral-400">Name</dt><dd className="font-medium text-neutral-800"><Val>{b.pocName}</Val></dd></div>
                <div><dt className="text-xs text-neutral-400">Email</dt><dd className="font-medium text-neutral-800"><Val>{b.pocEmail}</Val></dd></div>
              </dl>
            </div>
          )}

          {/* Claim / ownership */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
            <p className="mb-3 text-xs leading-relaxed text-neutral-400">
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
        </aside>
      </div>
    </div>
  );
}

function Block({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="mb-12">
      <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-neutral-400">{title}</h2>
      {note && <p className="-mt-2 mb-4 text-xs text-neutral-400">{note}</p>}
      {children}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "pass") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-600/20 bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        Pass
      </span>
    );
  }
  if (status === "fail") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/20 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-600">
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M6 18L18 6" /></svg>
        Not met
      </span>
    );
  }
  return <span className="text-xs text-neutral-300">—</span>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="mb-1.5 text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</dt>
      <dd className="text-sm text-neutral-700">{children}</dd>
    </div>
  );
}
