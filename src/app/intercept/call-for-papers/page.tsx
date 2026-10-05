import type { Metadata } from "next";
import Link from "next/link";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import { EVENT } from "@/data/intercept";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-i" });

export const metadata: Metadata = {
  title: "Call for Papers — INTERCEPT",
  description:
    "INTERCEPT Call for Papers — open now, closes December 31, 2026. Blind-reviewed talks from the AARM community: builders, breakers, and defenders of agentic runtime security. Feb 2027, San Francisco.",
};

const AMBER = "#FF7A00";
const GREEN = "#2EFF7B";
const RED = "#FF3B30";
const BLUE = "#8AB4FF";
const OVERLEAF = "https://www.overleaf.com/latex/templates/ieee-conference-template/grfzhhncsfqn";

const TRACKS = [
  {
    icon: "🔨",
    name: "Builders",
    color: AMBER,
    blurb: "You wrote the interception point. Walk us through the gateway, the policy engine, the SDK hooks, the identity model — the design calls you made and the ones you'd take back.",
    wants: ["How you enforce a decision before an action executes", "Context accumulation and intent alignment in practice", "Receipts, audit trails, and provable identity binding", "What conformance to AARM actually cost you to build"],
  },
  {
    icon: "💥",
    name: "Breakers",
    color: RED,
    blurb: "You got past it. A prompt that reached a tool it shouldn't have, a gateway you slipped, a policy you tricked. Bring the exploit and the receipts, not the theory.",
    wants: ["Turning a prompt into an unauthorized action", "Slipping gateways, policy, or DLP inspection", "Adversarial evals and red-team methodology that scales", "An incident, reconstructed end to end"],
  },
  {
    icon: "🛡️",
    name: "Defenders",
    color: GREEN,
    blurb: "You keep it running. The rollout that didn't break prod, the alert that fired in time, the least-privilege model your team can actually live with.",
    wants: ["Deploying runtime controls without breaking the agent", "Detection and telemetry your SOC actually reads", "Responding when an agent does something it shouldn't", "Governance that survives contact with reality"],
  },
];

const FORMATS = [
  { tag: "25 min", name: "Case study", detail: "One system, start to finish — what you built or broke, and what it taught you." },
  { tag: "40 min", name: "Deep dive", detail: "Architecture, threat model, and the hard trade-offs, in detail." },
  { tag: "8 min", name: "Lightning", detail: "One idea, one result, no filler." },
  { tag: "live", name: "Demo", detail: "The system doing the thing, on stage, for real." },
];

const TIMELINE = [
  { phase: "Submissions open now", window: "Get your paper in early — some slots fill on a rolling basis", color: GREEN },
  { phase: "Submissions close", window: "December 31, 2026", color: AMBER },
  { phase: "Blind review", window: "January 2027", color: AMBER },
  { phase: "Decisions + feedback", window: "By late January 2027", color: RED },
  { phase: "INTERCEPT", window: `${EVENT.dateStamp} · ${EVENT.location}`, color: BLUE },
];

export default function CallForPapersPage() {
  return (
    <div className={`${pixel.variable} ${mono.variable} min-h-screen bg-[#0A0A0A] text-neutral-200`} style={{ fontFamily: "var(--font-mono-i)" }}>
      {/* scanline overlay */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0, #fff 1px, transparent 1px, transparent 3px)" }} />

      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-[#0A0A0A]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/intercept" className="text-sm tracking-tight text-white" style={{ fontFamily: "var(--font-pixel)" }}>INTERCEPT</Link>
          <div className="flex items-center gap-4">
            <Link href="/intercept" className="font-mono text-[11px] uppercase tracking-widest text-neutral-400 transition-colors hover:text-white">← Event</Link>
            <Link href="/intercept/cfp" className="border border-[#FF7A00] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[#FF7A00] transition-colors hover:bg-[#FF7A00] hover:text-black">
              [ Submit a Paper ]
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="border-b border-neutral-900">
          <div className="mx-auto max-w-4xl px-6 py-16 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/light.svg" alt="AARM" className="mx-auto mb-6 h-6 w-auto opacity-90 sm:h-7" />
            <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.4em] text-neutral-500">An AARM event · {EVENT.dateStamp} · {EVENT.location}</div>
            <h1 className="mx-auto leading-[1.15] text-white" style={{ fontFamily: "var(--font-pixel)", fontSize: "clamp(1.8rem, 7vw, 4rem)" }}>
              CALL FOR<br />PAPERS
            </h1>
            <p className="mx-auto mt-8 max-w-2xl font-mono text-base leading-relaxed text-neutral-300">
              INTERCEPT is where the AARM community shows its work. If you build, break, or defend agentic runtime
              security, the stage is yours — a gateway you designed, an attack that landed, a rollout that held.
              Bring the system and the evidence.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="border border-[#2EFF7B] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[#2EFF7B]">● Open now</span>
              <span className="border border-neutral-700 px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest text-neutral-400">Closes December 31, 2026</span>
            </div>
            <div className="mt-8">
              <Link href="/intercept/cfp" className="inline-block border-2 border-[#FF7A00] bg-[#FF7A00] px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-black transition-colors hover:bg-transparent hover:text-[#FF7A00]">
                [ Submit a Paper ]
              </Link>
            </div>
          </div>
        </section>

        <div className="mx-auto max-w-4xl space-y-16 px-6 py-16">
          {/* AARM builders callout */}
          <div className="border-l-2 border-[#FF7A00] bg-[#FF7A00]/[0.06] p-6">
            <div className="mb-2 font-mono text-xs font-bold uppercase tracking-widest text-[#FF7A00]">Building AARM-conformant controls?</div>
            <p className="font-mono text-sm leading-relaxed text-neutral-300">
              This event exists so the companies building the standard can show what they shipped. If your team put a
              real interception, policy, or enforcement system into production, we want that talk. Technical depth over
              polish — bring the architecture, the numbers, and the scars.
            </p>
          </div>

          {/* Tracks */}
          <Section title="Three tracks">
            <p className="mb-8 max-w-2xl font-mono text-sm leading-relaxed text-neutral-400">
              {EVENT.tagline}. Choose the track that fits your talk. Spanning two? Submit to the one it leans toward and say so.
            </p>
            <div className="space-y-4">
              {TRACKS.map((t) => (
                <div key={t.name} className="border border-neutral-800 bg-neutral-950 p-6">
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-2xl">{t.icon}</span>
                    <h3 className="font-mono text-lg font-bold uppercase tracking-widest" style={{ color: t.color }}>{t.name}</h3>
                  </div>
                  <p className="mb-4 font-mono text-sm leading-relaxed text-neutral-300">{t.blurb}</p>
                  <ul className="grid gap-1.5 sm:grid-cols-2">
                    {t.wants.map((w) => (
                      <li key={w} className="flex gap-2 font-mono text-xs text-neutral-500">
                        <span style={{ color: t.color }}>›</span> {w}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Section>

          {/* Formats */}
          <Section title="Pick a format">
            <div className="grid gap-4 sm:grid-cols-2">
              {FORMATS.map((f) => (
                <div key={f.name} className="flex gap-4 border border-neutral-800 bg-neutral-950 p-5">
                  <span className="shrink-0 self-start border border-neutral-700 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-[#FF7A00]">{f.tag}</span>
                  <div>
                    <div className="mb-1 font-mono text-sm font-bold text-white">{f.name}</div>
                    <div className="font-mono text-xs leading-relaxed text-neutral-500">{f.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* What makes a strong talk */}
          <Section title="What earns a slot">
            <p className="mb-6 max-w-2xl font-mono text-sm leading-relaxed text-neutral-400">
              Reviewers reward substance. The strongest submissions have most of this:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                "A real system you built, attacked, or ran — not a plan",
                "The trade-offs and the decisions you'd redo",
                "Numbers: benchmarks, latency, catch rates, before/after",
                "Code, artifacts, or a demo that backs the claim",
                "A technique the room hasn't seen before",
                "Honest failure — what broke and why it mattered",
              ].map((s) => (
                <div key={s} className="flex gap-2 border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm leading-relaxed text-neutral-300">
                  <span className="text-[#2EFF7B]">▸</span> {s}
                </div>
              ))}
            </div>
          </Section>

          {/* Submission requirements */}
          <Section title="What to submit">
            <div className="space-y-4">
              <Req n="1" title="A conference paper — IEEE format (PDF)">
                Write it up with the{" "}
                <a href={OVERLEAF} target="_blank" rel="noopener noreferrer" className="text-[#FF7A00] underline hover:text-white">Overleaf IEEE conference template ↗</a>{" "}
                and export to PDF (under 4MB). The paper is required — it&apos;s what the reviewers read.
              </Req>
              <Req n="2" title="Three short sections">
                In the form you&apos;ll give your core topics, your key takeaways, and why it matters &amp; who it&apos;s for. Reviewers score each one.
              </Req>
              <Req n="3" title="Strip your identity">
                Review is blind. No author or company name anywhere — not the title, the sections, or the paper itself.{" "}
                <span className="text-[#FF3B30]">A paper that names an author or company will be deleted.</span>{" "}
                (You&apos;ll get full credit once it&apos;s accepted.)
              </Req>
            </div>
          </Section>

          {/* Review process */}
          <Section title="How review works">
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat k="Blind" v="The panel sees the work, never the name behind it." />
              <Stat k="3 evaluators" v="Three independent reviewers score your sections 1–10 and leave comments." />
              <Stat k="One decision" v="A chair accepts or rejects once at least three reviews are in." />
            </div>
            <p className="mt-4 font-mono text-sm leading-relaxed text-neutral-500">
              Accepted or not, you get every reviewer&apos;s scores and written feedback back. Standout papers may be accepted early, on a rolling basis.
            </p>
          </Section>

          {/* Timeline */}
          <Section title="Timeline">
            <div className="border-l border-neutral-800">
              {TIMELINE.map((t) => (
                <div key={t.phase} className="relative pl-6 pb-6 last:pb-0">
                  <span className="absolute left-0 top-1.5 -translate-x-1/2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <div className="font-mono text-sm text-white">{t.phase}</div>
                  <div className="mt-0.5 font-mono text-xs text-neutral-500">{t.window}</div>
                </div>
              ))}
            </div>
          </Section>

          {/* Benefits */}
          <Section title="If your paper is accepted">
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                "Free admission to INTERCEPT",
                "Your talk recorded and published",
                "The stage in front of the people building the standard",
                "Your name and company credited in the AARM community",
              ].map((b) => (
                <li key={b} className="flex gap-2 border border-neutral-800 bg-neutral-950 px-4 py-3 font-mono text-sm text-neutral-300">
                  <span className="text-[#2EFF7B]">✓</span> {b}
                </li>
              ))}
            </ul>
            <p className="mt-4 font-mono text-xs text-neutral-600">
              ✛ Travel and lodging aren&apos;t covered. Everyone on stage and in the room agrees to the event code of conduct.
            </p>
          </Section>

          {/* CTA */}
          <div className="border border-neutral-800 bg-neutral-950 p-8 text-center">
            <h2 className="mb-3 text-white" style={{ fontFamily: "var(--font-pixel)", fontSize: "clamp(1rem, 3.5vw, 1.6rem)" }}>SHIP IT</h2>
            <p className="mx-auto mb-6 max-w-md font-mono text-sm text-neutral-400">Sign in, build your speaker profile, and submit your paper. The window closes December 31, 2026.</p>
            <Link href="/intercept/cfp" className="inline-block border-2 border-[#FF7A00] bg-[#FF7A00] px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-black transition-colors hover:bg-transparent hover:text-[#FF7A00]">
              [ Submit a Paper ]
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-neutral-900 px-6 py-10 text-center">
        <Link href="/intercept" className="font-mono text-xs uppercase tracking-widest text-neutral-500 hover:text-white">← Back to INTERCEPT</Link>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-5 text-white" style={{ fontFamily: "var(--font-pixel)", fontSize: "clamp(1rem, 3.5vw, 1.7rem)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Req({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 border border-neutral-800 bg-neutral-950 p-5">
      <div className="shrink-0 text-[#FF7A00]" style={{ fontFamily: "var(--font-pixel)", fontSize: "0.9rem" }}>{n}</div>
      <div>
        <div className="mb-1 font-mono text-sm font-bold text-white">{title}</div>
        <p className="font-mono text-sm leading-relaxed text-neutral-400">{children}</p>
      </div>
    </div>
  );
}

function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div className="border border-neutral-800 bg-neutral-950 p-5">
      <div className="mb-1.5 font-mono text-sm font-bold uppercase tracking-widest text-[#FF7A00]">{k}</div>
      <div className="font-mono text-xs leading-relaxed text-neutral-400">{v}</div>
    </div>
  );
}
