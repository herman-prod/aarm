import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { eq } from "drizzle-orm";
import { auth } from "@/auth";
import { db, isDbConfigured } from "@/db";
import { builders, claims } from "@/db/schema";
import { setListingStatus, reviewClaim } from "@/lib/actions";
import { OrderingTable } from "@/components/ordering-table";
import { DeleteBuilderButton } from "@/components/delete-builder-button";
import { asc } from "drizzle-orm";
import { safeHttpUrl } from "@/lib/safe-url";

export const metadata: Metadata = { title: "Admin — AARM" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isDbConfigured || !db) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-24 text-center text-neutral-500">
        Admin tools come online once the database is provisioned.
      </div>
    );
  }

  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/admin");
  if (!(session.user as { isAdmin?: boolean }).isAdmin) {
    return <div className="mx-auto max-w-3xl px-6 py-24 text-center text-neutral-500">Admin access only.</div>;
  }

  const pendingListings = await db.select().from(builders).where(eq(builders.status, "pending"));
  const pendingClaims = await db
    .select({
      id: claims.id,
      userEmail: claims.userEmail,
      method: claims.method,
      builderName: builders.name,
      builderSlug: builders.slug,
    })
    .from(claims)
    .innerJoin(builders, eq(claims.builderId, builders.id))
    .where(eq(claims.status, "pending"));
  const approved = await db
    .select({
      id: builders.id, slug: builders.slug, name: builders.name, featured: builders.featured,
      priority: builders.priority, conformanceLevel: builders.conformanceLevel,
      claimedBy: builders.claimedBy, pocName: builders.pocName, pocEmail: builders.pocEmail,
      conformanceRequestStatus: builders.conformanceRequestStatus,
    })
    .from(builders)
    .where(eq(builders.status, "approved"))
    .orderBy(asc(builders.sortOrder));

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-neutral-900">TWG Admin</h1>
      <p className="mb-6 text-sm text-neutral-500">Review submissions and ownership claims.</p>

      {/* Quick links */}
      <div className="mb-12 grid gap-3 sm:grid-cols-3">
        <Link href="/admin/people" className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="font-semibold text-neutral-900">People &amp; roles</div>
          <div className="mt-0.5 text-xs text-neutral-500">See all users · make evaluators / chairs</div>
        </Link>
        <Link href="/admin/intercept" className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="font-semibold text-neutral-900">INTERCEPT signups</div>
          <div className="mt-0.5 text-xs text-neutral-500">Early-access interest list · export</div>
        </Link>
        <Link href="/builders" className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
          <div className="font-semibold text-neutral-900">Builder registry</div>
          <div className="mt-0.5 text-xs text-neutral-500">Edit conformance per listing</div>
        </Link>
      </div>

      {/* Listing queue */}
      <section className="mb-14">
        <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-neutral-400">
          Pending listings ({pendingListings.length})
        </h2>
        {pendingListings.length === 0 ? (
          <p className="text-sm text-neutral-400">Nothing pending.</p>
        ) : (
          <div className="space-y-3">
            {pendingListings.map((b) => (
              <div key={b.id} className="rounded-xl border border-neutral-100 p-5">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold text-neutral-900">{b.name}</span>
                  {b.category && <span className="text-xs text-neutral-400">· {b.category}</span>}
                </div>
                <p className="mb-1 text-sm text-neutral-500">{b.description}</p>
                <a href={safeHttpUrl(b.website) ?? "#"} target="_blank" rel="noopener noreferrer" className="text-xs" style={{ color: "#1A6EB5" }}>
                  {b.website}
                </a>
                <div className="mt-4 flex gap-2">
                  <form action={async () => { "use server"; await setListingStatus(b.id, "approved"); }}>
                    <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-85">Approve</button>
                  </form>
                  <form action={async () => { "use server"; await setListingStatus(b.id, "rejected"); }}>
                    <button className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">Reject</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Claim queue */}
      <section>
        <h2 className="mb-4 font-mono text-xs uppercase tracking-widest text-neutral-400">
          Pending claims ({pendingClaims.length})
        </h2>
        {pendingClaims.length === 0 ? (
          <p className="text-sm text-neutral-400">No claims awaiting review.</p>
        ) : (
          <div className="space-y-3">
            {pendingClaims.map((c) => (
              <div key={c.id} className="rounded-xl border border-neutral-100 p-5">
                <p className="text-sm text-neutral-700">
                  <span className="font-semibold">{c.userEmail || "(no email on account)"}</span>{" "}
                  <span className="text-neutral-400">wants to claim</span>{" "}
                  <Link href={`/builders/${c.builderSlug}`} className="font-semibold" style={{ color: "#1A6EB5" }}>
                    {c.builderName}
                  </Link>
                </p>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-wide text-neutral-400">
                  {c.method === "domain_match" ? "domain match" : "manual review"}
                </p>
                <div className="mt-4 flex gap-2">
                  <form action={async () => { "use server"; await reviewClaim(c.id, "approved"); }}>
                    <button className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:opacity-85">Approve</button>
                  </form>
                  <form action={async () => { "use server"; await reviewClaim(c.id, "rejected"); }}>
                    <button className="rounded-lg border border-neutral-200 px-3 py-1.5 text-xs font-semibold text-neutral-600 hover:bg-neutral-50">Reject</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Builders overview — claimed + POC */}
      <section className="mt-16">
        <div className="mb-4 flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">Builders — claimed & point of contact</span>
          <div className="h-px flex-1 bg-neutral-100" />
        </div>
        <div className="overflow-x-auto rounded-xl border border-neutral-100">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-neutral-50">
              <tr className="border-b border-neutral-100">
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">Company</th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">Claimed</th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">Point of contact</th>
                <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">Conformance</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {approved.map((b) => {
                const claimed = !!b.claimedBy;
                const hasPoc = !!b.pocEmail;
                return (
                  <tr key={b.id} className="border-b border-neutral-50 last:border-0">
                    <td className="px-4 py-2.5">
                      <a href={`/admin/${b.slug}`} className="font-medium hover:underline" style={{ color: "#1A6EB5" }}>{b.name}</a>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${claimed ? "bg-green-50 text-green-700" : "bg-neutral-100 text-neutral-400"}`}>
                        {claimed ? "Claimed" : "Unclaimed"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      {hasPoc ? (
                        <span className="text-neutral-700">{b.pocName ? `${b.pocName} · ` : ""}{b.pocEmail}</span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-700">Missing</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-[11px] uppercase text-neutral-500">
                      {(b.conformanceRequestStatus ?? "not_started").replace("_", " ")}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <DeleteBuilderButton builderId={b.id} name={b.name} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ordering & priority */}
      <section className="mt-16">
        <div className="mb-2 flex items-center gap-3">
          <span className="font-mono text-xs uppercase tracking-widest text-neutral-400">Registry order & priority</span>
          <div className="h-px flex-1 bg-neutral-100" />
        </div>
        <p className="mb-5 text-sm text-neutral-500">
          <strong>Featured</strong> pins a company to the top. <strong>Priority</strong> is a number —
          lower shows higher; blank falls back to the original order.
        </p>
        <OrderingTable builders={approved} />
      </section>

      <div className="mt-12 flex flex-wrap gap-x-4 gap-y-1 border-t border-neutral-100 pt-6 text-xs text-neutral-400">
        <span>Editing conformance is per-listing — open a builder and use the TWG controls.</span>
        <Link href="/builders" className="underline">Browse builders →</Link>
        <Link href="/admin/intercept" className="underline">INTERCEPT signups →</Link>
        <Link href="/admin/people" className="underline">People &amp; roles →</Link>
      </div>
    </div>
  );
}
