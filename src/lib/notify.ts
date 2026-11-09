// Email notifications via Resend's HTTP API (no SDK dependency).
// No-ops safely when RESEND_API_KEY isn't set, so submissions never break.

type NewListing = {
  name: string;
  website: string;
  description: string;
  category?: string;
  pocName?: string;
  pocEmail?: string;
  submittedBy?: string;
};

function recipients(): string[] {
  return (process.env.NOTIFY_TO || process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function notifyNewListing(b: NewListing): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = recipients();
  if (!key || to.length === 0) {
    console.info("[notify] skipped (RESEND_API_KEY or NOTIFY_TO not set)");
    return;
  }
  const from = process.env.NOTIFY_FROM || "AARM <onboarding@resend.dev>";
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://aarm.dev";

  const html = `
    <h2>New builder submission</h2>
    <p>A new company was submitted to the AARM registry and is awaiting review.</p>
    <table cellpadding="6" style="border-collapse:collapse;font-family:system-ui,sans-serif;font-size:14px">
      <tr><td><strong>Name</strong></td><td>${esc(b.name)}</td></tr>
      <tr><td><strong>Website</strong></td><td>${esc(b.website)}</td></tr>
      <tr><td><strong>Category</strong></td><td>${esc(b.category || "—")}</td></tr>
      <tr><td><strong>Description</strong></td><td>${esc(b.description)}</td></tr>
      <tr><td><strong>Point of contact</strong></td><td>${esc(b.pocName || "—")} ${b.pocEmail ? `&lt;${esc(b.pocEmail)}&gt;` : ""}</td></tr>
      <tr><td><strong>Submitted by</strong></td><td>${esc(b.submittedBy || "—")}</td></tr>
    </table>
    <p><a href="${site}/admin">Review in the admin queue →</a></p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `New AARM builder submission: ${b.name}`,
        html,
      }),
    });
    if (!res.ok) console.error("[notify] resend error", res.status, await res.text());
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

export async function notifyClaim(c: {
  builderName: string;
  builderSlug: string;
  userEmail: string;
  method: "domain_match" | "manual";
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const to = recipients();
  if (!key || to.length === 0) {
    console.info("[notify] claim skipped (not configured)");
    return;
  }
  const from = process.env.NOTIFY_FROM || "AARM <onboarding@resend.dev>";
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://aarm.dev";
  const auto = c.method === "domain_match";

  const html = `
    <h2>Listing claim ${auto ? "auto-approved" : "needs review"}</h2>
    <p><strong>${esc(c.userEmail)}</strong> claimed <strong>${esc(c.builderName)}</strong>
    via <em>${esc(c.method)}</em>.</p>
    <p>${auto
      ? "Domain matched — they now own the listing. No action needed."
      : "This claim is pending your approval in the admin queue."}</p>
    <p><a href="${site}/builders/${esc(c.builderSlug)}">View listing</a> ·
       <a href="${site}/admin">Open admin queue →</a></p>
  `;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: `Claim ${auto ? "auto-approved" : "to review"}: ${c.builderName}`,
        html,
      }),
    });
    if (!res.ok) console.error("[notify] resend error", res.status, await res.text());
  } catch (e) {
    console.error("[notify] claim failed", e);
  }
}

async function sendEmail(to: string[], subject: string, html: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  if (!key || to.length === 0) {
    console.info("[notify] skipped (not configured)");
    return;
  }
  const from = process.env.NOTIFY_FROM || "AARM <onboarding@resend.dev>";
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) console.error("[notify] resend error", res.status, await res.text());
  } catch (e) {
    console.error("[notify] send failed", e);
  }
}

const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "https://aarm.dev";

/** Email the submitter when their listing is approved or rejected. */
export async function notifyListingDecision(p: { to: string; name: string; slug: string; approved: boolean }) {
  if (!p.to) return;
  const html = p.approved
    ? `<h2>Your AARM listing is live</h2>
       <p><strong>${esc(p.name)}</strong> has been approved and now appears in the AARM builder registry.</p>
       <p><a href="${SITE()}/builders/${esc(p.slug)}">View your listing →</a></p>
       <p>Sign in and choose <em>“Manage this listing”</em> to keep your details up to date.</p>`
    : `<h2>Update on your AARM submission</h2>
       <p>Thanks for submitting <strong>${esc(p.name)}</strong> to the AARM registry. After review, it wasn’t approved for listing at this time.</p>
       <p>Reply to this email if you’d like feedback or want to resubmit.</p>`;
  await sendEmail(
    [p.to],
    p.approved ? `Your AARM listing is live: ${p.name}` : `Update on your AARM submission: ${p.name}`,
    html
  );
}

/** Email the requester when their manage request is approved or rejected. */
export async function notifyClaimDecision(p: { to: string; builderName: string; builderSlug: string; approved: boolean }) {
  if (!p.to) return;
  const html = p.approved
    ? `<h2>You can now manage ${esc(p.builderName)}</h2>
       <p>Your request to manage <strong>${esc(p.builderName)}</strong> on AARM was approved.</p>
       <p><a href="${SITE()}/builders/${esc(p.builderSlug)}/edit">Manage your listing →</a></p>`
    : `<h2>Update on your AARM request</h2>
       <p>Your request to manage <strong>${esc(p.builderName)}</strong> wasn’t approved. If you believe this is a mistake, reply to this email and we’ll take another look.</p>`;
  await sendEmail(
    [p.to],
    p.approved ? `You can now manage ${p.builderName} on AARM` : `Update on your AARM request: ${p.builderName}`,
    html
  );
}

/** INTERCEPT interest confirmation to the registrant (+ a team heads-up). */
export async function notifyInterceptSignup(p: { to: string; name?: string; role?: string }) {
  if (!p.to) return;
  const name = (p.name && p.name.trim()) || "there";
  const role = (p.role || "attendee").toUpperCase();
  const mono = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  const AMBER = "#FF7A00", GREEN = "#2EFF7B", INK = "#0A0A0A", LINE = "#1f1f1f", MUTE = "#737373";

  // Table-based layout for email-client compatibility. Reads like a
  // tamper-evident access-pass receipt in the INTERCEPT arcade style.
  const html = `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000000;margin:0;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:${INK};border:1px solid ${LINE}">

        <!-- perforated top edge -->
        <tr><td style="height:6px;background-image:repeating-linear-gradient(90deg,${AMBER} 0,${AMBER} 10px,${INK} 10px,${INK} 16px);line-height:6px;font-size:0">&nbsp;</td></tr>

        <!-- header -->
        <tr><td style="padding:34px 34px 0;font-family:${mono}">
          <img src="${SITE()}/logo/light.png" width="104" alt="AARM" style="display:block;height:auto;border:0;margin-bottom:18px" />
          <div style="font-size:10px;letter-spacing:5px;color:${AMBER};text-transform:uppercase">&#9698; Access request received</div>
          <div style="font-size:40px;line-height:1;font-weight:800;letter-spacing:5px;color:#ffffff;margin-top:16px">INTERCEPT</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:3px;color:${MUTE};margin-top:10px">Builders &middot; Breakers &middot; Defenders of Agentic Runtime Security</div>
        </td></tr>

        <tr><td style="padding:26px 34px 0"><div style="height:1px;background:${LINE};font-size:0;line-height:0">&nbsp;</div></td></tr>

        <!-- message -->
        <tr><td style="padding:22px 34px 0;font-family:${mono}">
          <p style="color:#e5e5e5;font-size:14px;margin:0 0 12px">Dear ${esc(name)},</p>
          <p style="color:#a3a3a3;font-size:14px;line-height:1.7;margin:0">
            We&rsquo;ve got your request. Thanks for registering your interest in
            <strong style="color:#ffffff">INTERCEPT</strong> — we&rsquo;ll email you with the
            details as the program, speakers, and venue come together.
          </p>
        </td></tr>

        <!-- access pass -->
        <tr><td style="padding:24px 34px 0;font-family:${mono}">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;border:1px solid ${LINE}">
            <tr><td style="padding:18px 20px">
              <div style="color:${GREEN};font-weight:700;font-size:13px;letter-spacing:2px">&#9635; ACCESS PASS &nbsp; // &nbsp; INTEREST: SUBMITTED</div>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px">
                <tr>
                  <td style="width:50%;vertical-align:top">
                    <div style="color:${MUTE};font-size:9px;letter-spacing:2px;text-transform:uppercase">Holder</div>
                    <div style="color:#fff;font-size:14px;margin-top:4px">${esc(name)}</div>
                  </td>
                  <td style="width:50%;vertical-align:top">
                    <div style="color:${MUTE};font-size:9px;letter-spacing:2px;text-transform:uppercase">Track</div>
                    <div style="color:#fff;font-size:14px;margin-top:4px">${esc(role)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:14px;vertical-align:top">
                    <div style="color:${MUTE};font-size:9px;letter-spacing:2px;text-transform:uppercase">Date</div>
                    <div style="color:#fff;font-size:14px;margin-top:4px">OCT 14 2026</div>
                  </td>
                  <td style="padding-top:14px;vertical-align:top">
                    <div style="color:${MUTE};font-size:9px;letter-spacing:2px;text-transform:uppercase">Location</div>
                    <div style="color:#fff;font-size:14px;margin-top:4px">San Francisco</div>
                  </td>
                </tr>
              </table>
            </td></tr>
            <!-- fake barcode -->
            <tr><td style="height:26px;background-image:repeating-linear-gradient(90deg,#3a3a3a 0,#3a3a3a 2px,#000 2px,#000 4px,#555 4px,#555 5px,#000 5px,#000 9px);line-height:26px;font-size:0">&nbsp;</td></tr>
          </table>
        </td></tr>

        <!-- footer -->
        <tr><td style="padding:22px 34px 30px;font-family:${mono}">
          <p style="color:#525252;font-size:12px;margin:0">
            &mdash; The AARM team &nbsp;&middot;&nbsp;
            <a href="https://aarm.dev/intercept" style="color:${AMBER};text-decoration:none">aarm.dev/intercept</a>
          </p>
        </td></tr>

        <!-- perforated bottom edge -->
        <tr><td style="height:6px;background-image:repeating-linear-gradient(90deg,${LINE} 0,${LINE} 10px,${INK} 10px,${INK} 16px);line-height:6px;font-size:0">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>`;
  await sendEmail([p.to], "We've got your INTERCEPT request", html);

  const team = recipients();
  if (team.length) {
    await sendEmail(
      team,
      `INTERCEPT interest: ${p.to}`,
      `<p style="font-family:sans-serif">${esc(p.to)}${p.name ? ` (${esc(p.name)})` : ""}${p.role ? ` — ${esc(p.role)}` : ""} registered interest in INTERCEPT.</p>`
    );
  }
}

function interceptShell(bodyHtml: string) {
  const mono = "'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#000;margin:0;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:100%;background:#0A0A0A;border:1px solid #1f1f1f">
        <tr><td style="height:6px;background-image:repeating-linear-gradient(90deg,#FF7A00 0,#FF7A00 10px,#0A0A0A 10px,#0A0A0A 16px);line-height:6px;font-size:0">&nbsp;</td></tr>
        <tr><td style="padding:32px 34px;font-family:${mono}">
          <img src="${SITE()}/logo/light.png" width="104" alt="AARM" style="display:block;height:auto;border:0;margin-bottom:16px" />
          <div style="font-size:32px;font-weight:800;letter-spacing:5px;color:#fff">INTERCEPT</div>
          <div style="font-size:10px;text-transform:uppercase;letter-spacing:3px;color:#737373;margin-top:8px">Call for Papers</div>
          <div style="height:1px;background:#1f1f1f;margin:22px 0"></div>
          ${bodyHtml}
          <p style="color:#525252;font-size:12px;margin:24px 0 0">&mdash; The AARM team &middot; <a href="https://aarm.dev/intercept" style="color:#FF7A00;text-decoration:none">aarm.dev/intercept</a></p>
        </td></tr>
        <tr><td style="height:6px;background-image:repeating-linear-gradient(90deg,#1f1f1f 0,#1f1f1f 10px,#0A0A0A 10px,#0A0A0A 16px);line-height:6px;font-size:0">&nbsp;</td></tr>
      </table>
    </td></tr>
  </table>`;
}

/** CFP: confirmation to the author on submission. */
export async function notifyPaperSubmitted(p: { to: string; talkTitle: string }) {
  if (!p.to) return;
  await sendEmail([p.to], "Your INTERCEPT paper is submitted", interceptShell(`
    <p style="color:#e5e5e5;font-size:14px">Your paper has been submitted.</p>
    <p style="color:#a3a3a3;font-size:14px;line-height:1.7">
      &ldquo;<strong style="color:#fff">${esc(p.talkTitle)}</strong>&rdquo; is now
      <span style="color:#FF7A00">PENDING</span> blind review. Track its status any time in your
      INTERCEPT dashboard — we&rsquo;ll email you when the review completes.
    </p>`));
}

/** CFP: notify the organizer when a paper is submitted or resubmitted (ops, not blind). */
export async function notifyPaperSubmittedAdmin(p: { talkTitle: string; authorEmail?: string; resubmission?: boolean }) {
  const to = process.env.CFP_NOTIFY_TO || "herman@aarm.dev";
  const verb = p.resubmission ? "resubmitted" : "submitted";
  await sendEmail([to], `INTERCEPT CFP: paper ${verb}`, interceptShell(`
    <p style="color:#e5e5e5;font-size:14px">A paper was <strong style="color:#fff">${verb}</strong> to the INTERCEPT call for papers.</p>
    <p style="color:#a3a3a3;font-size:14px;line-height:1.7">
      &ldquo;<strong style="color:#fff">${esc(p.talkTitle)}</strong>&rdquo;${p.authorEmail ? ` — from <span style="color:#fff">${esc(p.authorEmail)}</span>` : ""}.
    </p>
    <p style="margin:16px 0 0"><a href="https://aarm.dev/intercept/review" style="color:#2EFF7B;text-decoration:none">→ Open the review console</a></p>`));
}

/** CFP: someone was granted the evaluator role. */
export async function notifyRoleGranted(p: { to: string; role: string }) {
  if (!p.to) return;
  await sendEmail([p.to], `You're an INTERCEPT ${p.role}`, interceptShell(`
    <p style="color:#e5e5e5;font-size:14px">You&rsquo;ve been added as an <strong style="color:#fff">${esc(p.role)}</strong>.</p>
    <p style="color:#a3a3a3;font-size:14px;line-height:1.7">Open the review console to score submitted papers (blind).</p>
    <p style="margin:16px 0 0"><a href="https://aarm.dev/intercept/review" style="color:#2EFF7B;text-decoration:none">→ Open the review console</a></p>`));
}

/** CFP: a blind review was completed — notify evaluator + author. */
export async function notifyReviewComplete(p: { evaluatorEmail?: string; authorEmail?: string; paperNumber: number; talkTitle: string }) {
  if (p.evaluatorEmail) {
    await sendEmail([p.evaluatorEmail], `Review recorded — Paper #${p.paperNumber}`, interceptShell(`
      <p style="color:#e5e5e5;font-size:14px">Your review of <strong style="color:#fff">Paper #${p.paperNumber}</strong> is recorded. Thank you.</p>`));
  }
  if (p.authorEmail) {
    await sendEmail([p.authorEmail], "Your INTERCEPT paper has been reviewed", interceptShell(`
      <p style="color:#e5e5e5;font-size:14px">Your paper has completed a review round.</p>
      <p style="color:#a3a3a3;font-size:14px;line-height:1.7">
        &ldquo;<strong style="color:#fff">${esc(p.talkTitle)}</strong>&rdquo; has been evaluated. We&rsquo;ll
        follow up with the final programme decision.
      </p>`));
  }
}

/** CFP: chair decision (accepted/rejected) to the author. */
export async function notifyPaperDecision(p: { authorEmail: string; talkTitle: string; decision: "accepted" | "rejected" }) {
  if (!p.authorEmail) return;
  const accepted = p.decision === "accepted";
  await sendEmail([p.authorEmail], accepted ? "Your INTERCEPT talk is accepted" : "Update on your INTERCEPT submission", interceptShell(`
    <p style="color:#e5e5e5;font-size:14px">${accepted ? "Congratulations — your talk has been accepted." : "Thanks for your submission."}</p>
    <p style="color:#a3a3a3;font-size:14px;line-height:1.7">
      &ldquo;<strong style="color:#fff">${esc(p.talkTitle)}</strong>&rdquo; ${accepted
        ? "was selected for INTERCEPT. We&rsquo;ll follow up shortly with speaker logistics."
        : "was not selected for the programme this time. You can read the reviewers&rsquo; feedback on your submission page."}
    </p>
    <p style="margin:20px 0 0">
      <a href="${SITE()}/intercept/cfp" style="display:inline-block;border:2px solid #FF7A00;color:#FF7A00;text-decoration:none;font-weight:700;font-size:12px;letter-spacing:2px;text-transform:uppercase;padding:12px 20px">Review your submission →</a>
    </p>`));
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
