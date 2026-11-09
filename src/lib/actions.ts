"use server";

import { revalidatePath } from "next/cache";
import { eq, and, ne } from "drizzle-orm";
import { auth } from "@/auth";
import { db, isDbConfigured } from "@/db";
import { builders, claims, users, interceptSignups, speakerProfiles, papers, paperReviews, paperAssignments } from "@/db/schema";
import type {
  Category, Surface, Stage, ProductType, Audience, Deployment,
  InterceptionArchitecture, PolicyModel, AuthDecision,
} from "@/db/taxonomy";
import {
  notifyNewListing, notifyClaim, notifyListingDecision, notifyClaimDecision, notifyInterceptSignup,
  notifyPaperSubmitted, notifyPaperSubmittedAdmin, notifyReviewComplete, notifyRoleGranted, notifyPaperDecision,
} from "@/lib/notify";
import { ACTIVATION_CODE } from "@/lib/conformance-config";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { safeHttpUrl } from "@/lib/safe-url";
import { isOwnPaperBlob } from "@/lib/paper-blob";

/** Rejects over-long free text so a single field can't bloat rows or emails. */
function maxLen(value: string | null | undefined, max: number, label: string) {
  if (value && value.length > max) throw new Error(`${label} is too long (max ${max} characters).`);
}

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function domainOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\/(www\.)?/, "").split("/")[0];
  }
}

async function requireDb() {
  if (!isDbConfigured || !db) throw new Error("Database not configured yet.");
  return db;
}
async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Not signed in.");
  return session.user as { id: string; email?: string; isAdmin?: boolean; emailDomain?: string };
}
async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) throw new Error("Admin only.");
  return user;
}

/** Anyone signed in can submit a new listing → enters the pending queue. */
export async function submitListing(input: {
  name: string;
  website: string;
  description: string;
  category?: Category;
  surfaces?: Surface[];
  stage?: Stage;
  types?: ProductType[];
  audiences?: Audience[];
  deployments?: Deployment[];
  pocName?: string;
  pocEmail?: string;
}) {
  const database = await requireDb();
  const user = await requireUser();
  await rateLimit(`listing:${user.id}`, 5, 3600);

  const website = safeHttpUrl(input.website);
  if (!website) throw new Error("Enter a valid http(s) website URL.");
  input = { ...input, website };
  maxLen(input.name, 120, "Company name");
  maxLen(input.description, 2000, "Description");
  maxLen(input.pocName, 120, "Point-of-contact name");
  maxLen(input.pocEmail, 254, "Point-of-contact email");

  // Ensure a unique slug — a company with the same name may already be listed.
  const base = slugify(input.name);
  const clash = await database.select({ id: builders.id }).from(builders).where(eq(builders.slug, base)).limit(1);
  const slug = clash.length ? `${base}-${user.id.slice(0, 6)}` : base;

  // If the submitter lists their own email as the point of contact, they have
  // effectively claimed the page — bind ownership to them now.
  const selfPoc =
    !!input.pocEmail && !!user.email && input.pocEmail.trim().toLowerCase() === user.email.toLowerCase();

  await database.insert(builders).values({
    slug,
    name: input.name,
    website: input.website,
    domain: domainOf(input.website),
    description: input.description,
    category: input.category,
    surfaces: input.surfaces ?? [],
    stage: input.stage,
    types: input.types ?? [],
    audiences: input.audiences ?? [],
    deployments: input.deployments ?? [],
    pocName: input.pocName,
    pocEmail: input.pocEmail,
    conformanceLevel: "aligned",
    status: "pending",
    createdBy: user.id,
    claimedBy: selfPoc ? user.id : undefined,
    // Land new submissions at the bottom of the registry by default; admins can
    // lift them with priority/featured in the admin panel. (Seed rows use 0–~99.)
    sortOrder: 100000,
  });
  // Fire-and-forget; never let a notification failure break submission.
  await notifyNewListing({
    name: input.name,
    website: input.website,
    description: input.description,
    category: input.category,
    pocName: input.pocName,
    pocEmail: input.pocEmail,
    submittedBy: user.email,
  });
  revalidatePath("/builders");
}

/** Visitor claims a listing. Domain match → auto-approve; else manual queue. */
export async function requestClaim(builderId: string) {
  const database = await requireDb();
  const user = await requireUser();
  const [b] = await database.select().from(builders).where(eq(builders.id, builderId)).limit(1);
  if (!b) throw new Error("Listing not found.");
  if (b.claimedBy === user.id) throw new Error("You already maintain this listing.");
  await rateLimit(`claim:${user.id}`, 5, 3600);

  const [pending] = await database
    .select({ id: claims.id })
    .from(claims)
    .where(and(eq(claims.builderId, builderId), eq(claims.userId, user.id), eq(claims.status, "pending")))
    .limit(1);
  if (pending) return { status: "pending" as const };

  // Domain match auto-approves only an unowned listing; taking over a listing
  // someone else already maintains always goes to manual TWG review.
  const domainMatch = !!user.emailDomain && user.emailDomain === b.domain && !b.claimedBy;
  await database.insert(claims).values({
    builderId,
    userId: user.id,
    userEmail: user.email ?? "",
    method: domainMatch ? "domain_match" : "manual",
    status: domainMatch ? "approved" : "pending",
    reviewedAt: domainMatch ? new Date() : null,
  });

  await notifyClaim({
    builderName: b.name,
    builderSlug: b.slug,
    userEmail: user.email ?? "",
    method: domainMatch ? "domain_match" : "manual",
  });

  if (domainMatch) {
    await database.update(builders).set({ claimedBy: user.id }).where(eq(builders.id, builderId));
    revalidatePath(`/builders/${b.slug}`);
    return { status: "approved" as const };
  }
  return { status: "pending" as const };
}

/** Claimed owner edits marketing + classification only. */
export async function updateOwnedBuilder(
  builderId: string,
  input: {
    description?: string;
    logoUrl?: string;
    category?: Category;
    secondaryCategory?: Category;
    surfaces?: Surface[];
    stage?: Stage;
    types?: ProductType[];
    audiences?: Audience[];
    deployments?: Deployment[];
    // Self-reported technical profile (the conformance verdict stays TWG-only).
    interception?: InterceptionArchitecture[];
    policyModel?: PolicyModel;
    decisions?: AuthDecision[];
    pocName?: string;
    pocEmail?: string;
  }
) {
  const database = await requireDb();
  const user = await requireUser();
  const [b] = await database.select().from(builders).where(eq(builders.id, builderId)).limit(1);
  if (!b) throw new Error("Listing not found.");
  if (b.claimedBy !== user.id && !user.isAdmin) throw new Error("You don't own this listing.");

  // Point of contact is required for owned listings.
  if (!input.pocName?.trim() || !input.pocEmail?.trim()) {
    throw new Error("A point-of-contact name and email are required.");
  }
  if (!/^\S+@\S+\.\S+$/.test(input.pocEmail.trim())) {
    throw new Error("Enter a valid point-of-contact email.");
  }
  maxLen(input.description, 2000, "Description");
  maxLen(input.pocName, 120, "Point-of-contact name");
  maxLen(input.pocEmail, 254, "Point-of-contact email");
  const logoUrl = input.logoUrl ? safeHttpUrl(input.logoUrl) : input.logoUrl;
  if (input.logoUrl && !logoUrl) throw new Error("Logo URL must be an http(s) URL.");

  // Explicit allowlist. Server actions accept arbitrary JSON at runtime, so
  // spreading `input` would let an owner set TWG-only fields like
  // conformanceLevel, featured, status, or claimedBy.
  await database
    .update(builders)
    .set({
      description: input.description,
      logoUrl,
      category: input.category,
      secondaryCategory: input.secondaryCategory,
      surfaces: input.surfaces,
      stage: input.stage,
      types: input.types,
      audiences: input.audiences,
      deployments: input.deployments,
      interception: input.interception,
      policyModel: input.policyModel,
      decisions: input.decisions,
      pocName: input.pocName,
      pocEmail: input.pocEmail,
      updatedAt: new Date(),
    })
    .where(eq(builders.id, builderId));
  revalidatePath(`/builders/${b.slug}`);
  revalidatePath("/builders");
}

// ── Admin (TWG) ──────────────────────────────────────────────────────────

/** Admin-only: pin/prioritize a builder in the registry order. */
export async function setBuilderOrdering(
  builderId: string,
  input: { priority?: number | null; featured?: boolean }
) {
  const database = await requireDb();
  await requireAdmin();
  await database
    .update(builders)
    .set({
      priority: input.priority === undefined ? undefined : input.priority,
      featured: input.featured,
      updatedAt: new Date(),
    })
    .where(eq(builders.id, builderId));
  revalidatePath("/builders");
  revalidatePath("/admin");
}

/**
 * Admin: remove a company page. Soft-delete (status "deleted") so it disappears
 * from the public registry and admin lists but survives the bootstrap seed
 * (a hard delete would let seeded rows reappear on the next deploy) and stays
 * reversible.
 */
export async function deleteBuilder(builderId: string) {
  const database = await requireDb();
  await requireAdmin();
  await database.update(builders).set({ status: "deleted", updatedAt: new Date() }).where(eq(builders.id, builderId));
  revalidatePath("/builders");
  revalidatePath("/admin");
}

export async function setListingStatus(builderId: string, status: "approved" | "rejected") {
  const database = await requireDb();
  await requireAdmin();
  await database.update(builders).set({ status }).where(eq(builders.id, builderId));

  // Notify the submitter of the decision.
  const [b] = await database.select().from(builders).where(eq(builders.id, builderId)).limit(1);
  if (b?.createdBy) {
    const [u] = await database.select({ email: users.email }).from(users).where(eq(users.id, b.createdBy)).limit(1);
    if (u?.email) {
      await notifyListingDecision({ to: u.email, name: b.name, slug: b.slug, approved: status === "approved" });
    }
  }

  revalidatePath("/builders");
  revalidatePath("/admin");
}

export async function reviewClaim(claimId: string, decision: "approved" | "rejected") {
  const database = await requireDb();
  const admin = await requireAdmin();
  const [c] = await database.select().from(claims).where(eq(claims.id, claimId)).limit(1);
  if (!c) throw new Error("Claim not found.");
  await database
    .update(claims)
    .set({ status: decision, reviewedBy: admin.id, reviewedAt: new Date() })
    .where(eq(claims.id, claimId));
  const [b] = await database
    .select({ name: builders.name, slug: builders.slug })
    .from(builders)
    .where(eq(builders.id, c.builderId))
    .limit(1);
  if (decision === "approved") {
    await database.update(builders).set({ claimedBy: c.userId }).where(eq(builders.id, c.builderId));
  }
  if (c.userEmail && b) {
    await notifyClaimDecision({
      to: c.userEmail,
      builderName: b.name,
      builderSlug: b.slug,
      approved: decision === "approved",
    });
  }
  revalidatePath("/admin");
}

/** Admin-only: conformance + positioning + spec-grounded technical axes. */
export async function updateConformance(
  builderId: string,
  input: Partial<typeof builders.$inferInsert>
) {
  const database = await requireDb();
  await requireAdmin();
  await database.update(builders).set({ ...input, updatedAt: new Date() }).where(eq(builders.id, builderId));
  const [b] = await database.select().from(builders).where(eq(builders.id, builderId)).limit(1);
  if (b) revalidatePath(`/builders/${b.slug}`);
  revalidatePath("/builders");
  revalidatePath("/admin");
}

// ── Conformance request flow ───────────────────────────────────────────────

/** The builder the signed-in user has claimed (owns), or null. */
export async function getMyBuilder() {
  if (!isDbConfigured || !db) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  const [b] = await db.select().from(builders).where(eq(builders.claimedBy, session.user.id)).limit(1);
  return b ?? null;
}

/**
 * Owner starts a conformance review. Requires eligibility (both true) + explicit
 * agreement. Returns the activation code ONLY on success — it is never shipped
 * in client code, only returned to the eligible, authenticated owner.
 */
export async function startConformance(input: {
  hasSecurityCert: boolean;
  hasFiveCustomers: boolean;
  agreed: boolean;
  targetLevel: "core" | "extended";
}): Promise<{ activationCode: string }> {
  const database = await requireDb();
  const user = await requireUser();
  const [b] = await database.select().from(builders).where(eq(builders.claimedBy, user.id)).limit(1);
  if (!b) throw new Error("You need to claim your company listing first.");
  if (!input.hasSecurityCert || !input.hasFiveCustomers) {
    throw new Error("Both eligibility conditions must be met to start a conformance review.");
  }
  if (!input.agreed) throw new Error("You must acknowledge the evidence requirement to proceed.");

  await database
    .update(builders)
    .set({
      conformanceRequestStatus:
        b.conformanceRequestStatus === "not_started" || !b.conformanceRequestStatus
          ? "started"
          : b.conformanceRequestStatus,
      conformanceTargetLevel: input.targetLevel,
      updatedAt: new Date(),
    })
    .where(eq(builders.id, b.id));

  revalidatePath("/my-conformance");
  return { activationCode: ACTIVATION_CODE };
}

/** Admin: update a company's conformance-request status + MCP assessment id. */
export async function setConformanceRequest(
  builderId: string,
  input: { status?: "not_started" | "started" | "in_review" | "verified" | "declined"; assessmentId?: string | null }
) {
  const database = await requireDb();
  await requireAdmin();
  await database
    .update(builders)
    .set({
      conformanceRequestStatus: input.status,
      conformanceAssessmentId: input.assessmentId === undefined ? undefined : input.assessmentId,
      updatedAt: new Date(),
    })
    .where(eq(builders.id, builderId));
  revalidatePath("/my-conformance");
  revalidatePath("/admin");
}

// ── INTERCEPT event signup ─────────────────────────────────────────────────

export async function submitInterceptSignup(input: {
  email: string;
  name?: string;
  company?: string;
  role?: "builder" | "breaker" | "defender" | "";
}): Promise<{ ok: true }> {
  const database = await requireDb();
  const email = input.email.trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 254) throw new Error("Enter a valid email address.");
  maxLen(input.name, 120, "Name");
  maxLen(input.company, 120, "Company");
  // Unauthenticated + sends email: limit per IP and per recipient.
  await rateLimit(`signup-ip:${await clientIp()}`, 5, 3600);
  await rateLimit(`signup-email:${email}`, 2, 86400);

  // Already signed up → don't send another email. Same response either way, so
  // this can't be used to check whether an address is registered.
  const [existing] = await database
    .select({ id: interceptSignups.id })
    .from(interceptSignups)
    .where(eq(interceptSignups.email, email))
    .limit(1);
  if (existing) return { ok: true };

  // Store the signup in the existing Neon DB, then send the confirmation email.
  await database.insert(interceptSignups).values({
    email,
    name: input.name?.trim() || null,
    company: input.company?.trim() || null,
    role: input.role || null,
  });
  await notifyInterceptSignup({ to: email, name: input.name, role: input.role || undefined });
  return { ok: true };
}

// ── INTERCEPT · Call for Papers + blind review ─────────────────────────────

async function requireChairOrAdmin() {
  const u = await requireUser();
  if (!u.isAdmin && !(u as { isChair?: boolean }).isChair) throw new Error("Chair or admin only.");
  return u;
}
async function requireEvaluator() {
  const u = await requireUser();
  const flags = u as { isAdmin?: boolean; isChair?: boolean; isEvaluator?: boolean };
  if (!flags.isAdmin && !flags.isChair && !flags.isEvaluator) throw new Error("Evaluator access only.");
  return u;
}

export async function getSpeakerProfile() {
  const database = await requireDb();
  const u = await requireUser();
  const [p] = await database.select().from(speakerProfiles).where(eq(speakerProfiles.userId, u.id)).limit(1);
  return p ?? null;
}

export async function getMyPaper() {
  if (!isDbConfigured || !db) return null;
  const session = await auth();
  if (!session?.user?.id) return null;
  const [p] = await db.select().from(papers).where(eq(papers.userId, session.user.id)).limit(1);
  return p ?? null;
}

/** Step 1: create/update the speaker profile. */
export async function saveSpeakerProfile(input: {
  firstName: string; lastName: string; bio: string; title: string; companyWebsite: string;
}) {
  const database = await requireDb();
  const u = await requireUser();
  if (!input.firstName.trim() || !input.lastName.trim() || !input.bio.trim()) {
    throw new Error("First name, surname, and bio are required.");
  }
  maxLen(input.firstName, 80, "First name");
  maxLen(input.lastName, 80, "Surname");
  maxLen(input.bio, 2000, "Bio");
  maxLen(input.title, 160, "Title");
  maxLen(input.companyWebsite, 300, "Company website");
  if (input.companyWebsite?.trim() && !safeHttpUrl(input.companyWebsite)) {
    throw new Error("Company website must be an http(s) URL.");
  }
  await database
    .insert(speakerProfiles)
    .values({
      userId: u.id, firstName: input.firstName, lastName: input.lastName,
      bio: input.bio, title: input.title, companyWebsite: input.companyWebsite,
    })
    .onConflictDoUpdate({
      target: speakerProfiles.userId,
      set: {
        firstName: input.firstName, lastName: input.lastName, bio: input.bio,
        title: input.title, companyWebsite: input.companyWebsite, updatedAt: new Date(),
      },
    });
  revalidatePath("/intercept/profile");
}

/** Step 2: submit (or update) a paper. Requires a speaker profile first. */
export async function submitPaper(input: {
  talkTitle: string; coreTopics: string; keyTakeaways: string; relevance: string;
  fileUrl?: string; fileName?: string;
}) {
  const database = await requireDb();
  const u = await requireUser();

  const profile = await getSpeakerProfile();
  if (!profile) throw new Error("Create your speaker profile first.");

  if (!input.talkTitle.trim() || !input.coreTopics.trim() || !input.keyTakeaways.trim() || !input.relevance.trim()) {
    throw new Error("Talk title and all three sections are required.");
  }
  if (!input.fileUrl) {
    throw new Error("A PDF paper in IEEE conference format is required.");
  }
  maxLen(input.talkTitle, 200, "Talk title");
  maxLen(input.coreTopics, 4000, "Core topics");
  maxLen(input.keyTakeaways, 4000, "Key takeaways");
  maxLen(input.relevance, 4000, "Why it matters");
  maxLen(input.fileName, 200, "File name");
  // The file must be one this user uploaded. Otherwise an author could point
  // their paper at someone else's private blob and read it via the proxy.
  if (!isOwnPaperBlob(input.fileUrl, u.id)) {
    throw new Error("Please upload your paper again.");
  }
  await rateLimit(`paper:${u.id}`, 10, 3600);

  // One paper per author. Authors may resubmit (edit) while the paper is still
  // in the pipeline; once a final decision is made it's locked.
  const existing = await getMyPaper();
  if (existing && (existing.status === "accepted" || existing.status === "rejected")) {
    throw new Error("Your paper has a final decision and can no longer be changed.");
  }

  if (existing) {
    // Resubmission: update in place and re-enter review as pending.
    await database.update(papers).set({
      title: input.talkTitle, coreTopics: input.coreTopics,
      keyTakeaways: input.keyTakeaways, relevance: input.relevance,
      fileUrl: input.fileUrl, fileName: input.fileName, status: "pending",
      updatedAt: new Date(),
    }).where(eq(papers.id, existing.id));
  } else {
    await database.insert(papers).values({
      userId: u.id, title: input.talkTitle, coreTopics: input.coreTopics,
      keyTakeaways: input.keyTakeaways, relevance: input.relevance,
      fileUrl: input.fileUrl, fileName: input.fileName, status: "pending",
    });
  }
  await notifyPaperSubmitted({ to: u.email ?? "", talkTitle: input.talkTitle });
  await notifyPaperSubmittedAdmin({ talkTitle: input.talkTitle, authorEmail: u.email, resubmission: !!existing });
  revalidatePath("/intercept/cfp");
}

/**
 * The author's own reviews — anonymized (Evaluator 1, 2, 3…) — exposed only
 * once a decision has been made, so feedback doesn't leak mid-review.
 */
export async function getMyPaperReviews() {
  const database = await requireDb();
  const u = await requireUser();
  const [p] = await database.select().from(papers).where(eq(papers.userId, u.id)).limit(1);
  if (!p || (p.status !== "accepted" && p.status !== "rejected")) {
    return { status: p?.status ?? null, reviews: [] as { scoreCore: number | null; scoreTakeaways: number | null; scoreRelevance: number | null; commentCore: string | null; commentTakeaways: string | null; commentRelevance: string | null }[] };
  }
  const rows = await database
    .select({
      scoreCore: paperReviews.scoreCore, scoreTakeaways: paperReviews.scoreTakeaways, scoreRelevance: paperReviews.scoreRelevance,
      commentCore: paperReviews.commentCore, commentTakeaways: paperReviews.commentTakeaways, commentRelevance: paperReviews.commentRelevance,
    })
    .from(paperReviews)
    .where(and(eq(paperReviews.paperId, p.id), eq(paperReviews.completed, true)))
    .orderBy(paperReviews.createdAt);
  return { status: p.status, reviews: rows };
}

// ── Chair/admin: people + roles ────────────────────────────────────────────

export async function listPeople() {
  const database = await requireDb();
  await requireChairOrAdmin();
  return database
    .select({ id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin, isChair: users.isChair, isEvaluator: users.isEvaluator })
    .from(users);
}

export async function setUserRole(userId: string, input: { isEvaluator?: boolean; isChair?: boolean }) {
  const database = await requireDb();
  const actor = await requireChairOrAdmin();
  // Chairs manage evaluators; only admins can grant or revoke the chair role.
  if (input.isChair !== undefined && !actor.isAdmin) throw new Error("Only an admin can change the chair role.");
  const [target] = await database.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) throw new Error("User not found.");
  await database
    .update(users)
    .set({
      isEvaluator: typeof input.isEvaluator === "boolean" ? input.isEvaluator : undefined,
      isChair: typeof input.isChair === "boolean" ? input.isChair : undefined,
    })
    .where(eq(users.id, userId));
  if (input.isEvaluator && target?.email && !target.isEvaluator) {
    await notifyRoleGranted({ to: target.email, role: "evaluator" });
  }
  revalidatePath("/admin/people");
  void actor;
}

// ── Evaluator: blind review ────────────────────────────────────────────────

/** Papers to review (not your own), with your review status + average. Blind. */
export async function getReviewQueue() {
  const database = await requireDb();
  const u = await requireEvaluator();
  const rows = await database
    .select({ id: papers.id, number: papers.number, title: papers.title, status: papers.status })
    .from(papers)
    .where(ne(papers.userId, u.id))
    .orderBy(papers.number);
  const mine = await database.select().from(paperReviews).where(eq(paperReviews.evaluatorId, u.id));
  const byPaper = new Map(mine.map((r) => [r.paperId, r]));

  // Assignment gating: a paper with any assignments is visible only to the
  // evaluators the chair assigned; papers with none stay open to all.
  const assignments = await database.select().from(paperAssignments);
  const assignedByPaper = new Map<string, Set<string>>();
  for (const a of assignments) {
    if (!assignedByPaper.has(a.paperId)) assignedByPaper.set(a.paperId, new Set());
    assignedByPaper.get(a.paperId)!.add(a.evaluatorId);
  }

  return rows
    .filter((p) => {
      const assigned = assignedByPaper.get(p.id);
      return !assigned || assigned.size === 0 || assigned.has(u.id);
    })
    .map((p) => {
      const r = byPaper.get(p.id);
      const scores = r ? [r.scoreCore, r.scoreTakeaways, r.scoreRelevance].filter((s): s is number => s != null) : [];
      const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      return { ...p, reviewStatus: r?.completed ? "completed" : r ? "in_progress" : "not_started", avg };
    });
}

/**
 * Single access check for the review flow. Plain evaluators must be assigned
 * (when a paper has assignments); nobody scores their own paper; decided
 * papers are read-only.
 */
async function assertReviewAccess(
  u: { id: string; isAdmin?: boolean },
  paperId: string,
  mode: "view" | "score"
) {
  const database = await requireDb();
  const [p] = await database
    .select({ userId: papers.userId, status: papers.status })
    .from(papers)
    .where(eq(papers.id, paperId))
    .limit(1);
  if (!p) throw new Error("Paper not found.");
  const privileged = !!u.isAdmin || !!(u as { isChair?: boolean }).isChair;
  if (p.userId === u.id && (mode === "score" || !privileged)) {
    throw new Error("You can't review your own paper.");
  }
  if (mode === "score" && (p.status === "accepted" || p.status === "rejected")) {
    throw new Error("This paper already has a final decision.");
  }
  if (!privileged) {
    const assigned = await database
      .select({ evaluatorId: paperAssignments.evaluatorId })
      .from(paperAssignments)
      .where(eq(paperAssignments.paperId, paperId));
    if (assigned.length > 0 && !assigned.some((a) => a.evaluatorId === u.id)) {
      throw new Error("You're not assigned to review this paper.");
    }
  }
}

function validScore(v: unknown, label: string): number | null | undefined {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1 || v > 10) {
    throw new Error(`${label} score must be a whole number from 1 to 10.`);
  }
  return v;
}

/** A single paper for blind review — no author identity. */
export async function getPaperForReview(paperId: string) {
  const database = await requireDb();
  const u = await requireEvaluator();
  const [p] = await database
    .select({ id: papers.id, number: papers.number, title: papers.title, coreTopics: papers.coreTopics, keyTakeaways: papers.keyTakeaways, relevance: papers.relevance, fileUrl: papers.fileUrl, fileName: papers.fileName, status: papers.status })
    .from(papers)
    .where(eq(papers.id, paperId))
    .limit(1);
  if (!p) throw new Error("Paper not found.");
  await assertReviewAccess(u, paperId, "view");

  const [r] = await database
    .select()
    .from(paperReviews)
    .where(and(eq(paperReviews.paperId, paperId), eq(paperReviews.evaluatorId, u.id)))
    .limit(1);
  return { paper: p, review: r ?? null };
}

export async function saveReviewScores(paperId: string, input: {
  scoreCore?: number | null; commentCore?: string;
  scoreTakeaways?: number | null; commentTakeaways?: string;
  scoreRelevance?: number | null; commentRelevance?: string;
}) {
  const database = await requireDb();
  const u = await requireEvaluator();
  await assertReviewAccess(u, paperId, "score");

  // Explicit fields only. Spreading `input` after evaluatorId would let a
  // caller forge a review as another evaluator or mark it completed directly.
  const fields = {
    scoreCore: validScore(input.scoreCore, "Core topics"),
    scoreTakeaways: validScore(input.scoreTakeaways, "Key takeaways"),
    scoreRelevance: validScore(input.scoreRelevance, "Why it matters"),
    commentCore: input.commentCore,
    commentTakeaways: input.commentTakeaways,
    commentRelevance: input.commentRelevance,
  };
  maxLen(fields.commentCore, 4000, "Comment");
  maxLen(fields.commentTakeaways, 4000, "Comment");
  maxLen(fields.commentRelevance, 4000, "Comment");

  const [existing] = await database
    .select({ completed: paperReviews.completed })
    .from(paperReviews)
    .where(and(eq(paperReviews.paperId, paperId), eq(paperReviews.evaluatorId, u.id)))
    .limit(1);
  if (existing?.completed) throw new Error("This review is already completed.");

  await database
    .insert(paperReviews)
    .values({ paperId, evaluatorId: u.id, ...fields })
    .onConflictDoUpdate({
      target: [paperReviews.paperId, paperReviews.evaluatorId],
      set: { ...fields, updatedAt: new Date() },
    });
  revalidatePath("/intercept/review");
}

export async function completeReview(paperId: string) {
  const database = await requireDb();
  const u = await requireEvaluator();
  // Also blocks decided papers, so completing a review can't flip an accepted
  // or rejected paper back to under_review.
  await assertReviewAccess(u, paperId, "score");
  const [r] = await database
    .select()
    .from(paperReviews)
    .where(and(eq(paperReviews.paperId, paperId), eq(paperReviews.evaluatorId, u.id)))
    .limit(1);
  if (!r || r.scoreCore == null || r.scoreTakeaways == null || r.scoreRelevance == null) {
    throw new Error("Score all three sections before completing the review.");
  }
  if (r.completed) return;
  await database.update(paperReviews).set({ completed: true, completedAt: new Date() }).where(eq(paperReviews.id, r.id));
  await database.update(papers).set({ status: "under_review", updatedAt: new Date() }).where(eq(papers.id, paperId));

  const [p] = await database.select().from(papers).where(eq(papers.id, paperId)).limit(1);
  if (p) {
    const [author] = await database.select({ email: users.email }).from(users).where(eq(users.id, p.userId)).limit(1);
    await notifyReviewComplete({ evaluatorEmail: u.email, authorEmail: author?.email ?? "", paperNumber: p.number, talkTitle: p.title });
  }
  revalidatePath("/intercept/review");
}

// ── INTERCEPT · evaluators list + chair decisions ──────────────────────────

/** Public: explicitly-marked evaluators for the landing-page panel. */
export async function getEvaluators() {
  if (!isDbConfigured || !db) return [] as { name: string; title: string | null }[];
  const rows = await db
    .select({ name: users.name, first: speakerProfiles.firstName, last: speakerProfiles.lastName, title: speakerProfiles.title })
    .from(users)
    .leftJoin(speakerProfiles, eq(speakerProfiles.userId, users.id))
    .where(eq(users.isEvaluator, true));
  return rows.map((r) => ({
    name: r.first && r.last ? `${r.first} ${r.last}` : r.name || "Evaluator",
    title: r.title ?? null,
  }));
}

/** Chair/admin: all reviews for a paper (evaluator + 3 scores + 3 comments). */
export async function getPaperReviews(paperId: string) {
  const database = await requireDb();
  await requireChairOrAdmin();
  return database
    .select({
      evaluatorName: users.name, evaluatorEmail: users.email,
      scoreCore: paperReviews.scoreCore, scoreTakeaways: paperReviews.scoreTakeaways, scoreRelevance: paperReviews.scoreRelevance,
      commentCore: paperReviews.commentCore, commentTakeaways: paperReviews.commentTakeaways, commentRelevance: paperReviews.commentRelevance,
      completed: paperReviews.completed,
    })
    .from(paperReviews)
    .leftJoin(users, eq(users.id, paperReviews.evaluatorId))
    .where(eq(paperReviews.paperId, paperId));
}

/**
 * Chair/admin: submitter identity (blind to evaluators) plus the evaluator
 * roster with who's assigned and each one's review status. Powers the
 * "who submitted" line and the assignment picker.
 */
export async function getChairPaperMeta(paperId: string) {
  const database = await requireDb();
  await requireChairOrAdmin();

  const [p] = await database.select().from(papers).where(eq(papers.id, paperId)).limit(1);
  if (!p) throw new Error("Paper not found.");

  const [author] = await database
    .select({ name: users.name, email: users.email, first: speakerProfiles.firstName, last: speakerProfiles.lastName, title: speakerProfiles.title })
    .from(users)
    .leftJoin(speakerProfiles, eq(speakerProfiles.userId, users.id))
    .where(eq(users.id, p.userId))
    .limit(1);

  const evals = await database
    .select({ id: users.id, name: users.name, email: users.email, first: speakerProfiles.firstName, last: speakerProfiles.lastName })
    .from(users)
    .leftJoin(speakerProfiles, eq(speakerProfiles.userId, users.id))
    .where(eq(users.isEvaluator, true));

  const assignedRows = await database
    .select({ evaluatorId: paperAssignments.evaluatorId })
    .from(paperAssignments)
    .where(eq(paperAssignments.paperId, paperId));
  const assigned = new Set(assignedRows.map((a) => a.evaluatorId));

  const reviews = await database
    .select({ evaluatorId: paperReviews.evaluatorId, completed: paperReviews.completed })
    .from(paperReviews)
    .where(eq(paperReviews.paperId, paperId));
  const reviewBy = new Map(reviews.map((r) => [r.evaluatorId, r]));

  return {
    author: {
      name: author?.first && author?.last ? `${author.first} ${author.last}` : author?.name || "Unknown",
      email: author?.email ?? null,
      title: author?.title ?? null,
    },
    evaluators: evals
      .filter((e) => e.id !== p.userId) // authors can't review their own paper
      .map((e) => ({
        id: e.id,
        name: e.first && e.last ? `${e.first} ${e.last}` : e.name || e.email || "Evaluator",
        email: e.email,
        assigned: assigned.has(e.id),
        reviewStatus: reviewBy.get(e.id)?.completed ? "completed" : reviewBy.has(e.id) ? "in_progress" : "none",
      })),
  };
}

/** Chair/admin: set exactly which evaluators are assigned to a paper. */
export async function setPaperAssignments(paperId: string, evaluatorIds: string[]) {
  const database = await requireDb();
  await requireChairOrAdmin();

  const [p] = await database.select({ id: papers.id, userId: papers.userId }).from(papers).where(eq(papers.id, paperId)).limit(1);
  if (!p) throw new Error("Paper not found.");
  if (!Array.isArray(evaluatorIds) || evaluatorIds.some((id) => typeof id !== "string")) {
    throw new Error("Invalid evaluator list.");
  }
  // Only real evaluators can be assigned, and never the paper's author.
  const evaluatorRows = await database.select({ id: users.id }).from(users).where(eq(users.isEvaluator, true));
  const valid = new Set(evaluatorRows.map((e) => e.id));
  const ids = [...new Set(evaluatorIds)].filter((id) => id !== p.userId && valid.has(id));

  // Replace the assignment set for this paper.
  await database.delete(paperAssignments).where(eq(paperAssignments.paperId, paperId));
  if (ids.length > 0) {
    await database.insert(paperAssignments).values(ids.map((evaluatorId) => ({ paperId, evaluatorId })));
  }
  revalidatePath("/intercept/review");
  return { assigned: ids.length };
}

/** Chair/admin: accept or reject a paper; emails the author the outcome. */
export async function setPaperDecision(paperId: string, decision: "accepted" | "rejected") {
  const database = await requireDb();
  await requireChairOrAdmin();
  if (decision !== "accepted" && decision !== "rejected") throw new Error("Invalid decision.");

  // Require at least 3 completed reviews before any decision.
  const completed = await database
    .select({ id: paperReviews.id })
    .from(paperReviews)
    .where(and(eq(paperReviews.paperId, paperId), eq(paperReviews.completed, true)));
  if (completed.length < 3) {
    throw new Error(`At least 3 completed reviews are required before a decision (${completed.length}/3).`);
  }

  await database.update(papers).set({ status: decision, updatedAt: new Date() }).where(eq(papers.id, paperId));
  const [p] = await database.select().from(papers).where(eq(papers.id, paperId)).limit(1);
  if (p) {
    const [author] = await database.select({ email: users.email }).from(users).where(eq(users.id, p.userId)).limit(1);
    await notifyPaperDecision({ authorEmail: author?.email ?? "", talkTitle: p.title, decision });
  }
  revalidatePath("/intercept/review");
}
