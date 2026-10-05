import type { Metadata } from "next";
import { Press_Start_2P, JetBrains_Mono } from "next/font/google";
import { InterceptSignup } from "@/components/intercept-signup";
import { InterceptAccountMenu } from "@/components/intercept-account-menu";
import { auth } from "@/auth";
import { getEvaluators } from "@/lib/actions";
import { EVENT, EMCEE, SPEAKERS, PROGRAM } from "@/data/intercept";

const pixel = Press_Start_2P({ weight: "400", subsets: ["latin"], variable: "--font-pixel" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-i" });

export const metadata: Metadata = {
  title: "INTERCEPT — Builders & Breakers of Agentic Runtime Security",
  description: "INTERCEPT · Feb 2027. The conference for builders and breakers of agentic runtime security. An AARM event.",
};

const AMBER = "#FF7A00";
const GREEN = "#2EFF7B";
const RED = "#FF3B30";

const NAV = [
  ["Program", "#program"], ["Speakers", "#speakers"], ["Sponsors", "#sponsors"], ["Call for Papers", "#cfp"],
] as const;

export const dynamic = "force-dynamic";

export default async function InterceptPage() {
  const session = await auth();
  const u = session?.user as
    | { name?: string | null; email?: string | null; image?: string | null; isChair?: boolean; isEvaluator?: boolean }
    | undefined;
  const signedIn = !!session?.user;
  const evaluators = await getEvaluators();
  return (
    <div className={`${pixel.variable} ${mono.variable} min-h-screen bg-[#0A0A0A] text-neutral-200`} style={{ fontFamily: "var(--font-mono-i)" }}>
      {/* scanline overlay */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-[1] opacity-[0.06]" style={{ backgroundImage: "repeating-linear-gradient(to bottom, #fff 0, #fff 1px, transparent 1px, transparent 3px)" }} />

      {/* Nav */}
      <header className="sticky top-0 z-30 border-b border-neutral-900 bg-[#0A0A0A]/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#top" className="text-sm tracking-tight text-white" style={{ fontFamily: "var(--font-pixel)" }}>INTERCEPT</a>
          <nav className="hidden items-center gap-6 md:flex">
            {NAV.map(([label, href]) => (
              <a key={href} href={href} className="font-mono text-xs uppercase tracking-widest text-neutral-400 transition-colors hover:text-white">{label}</a>
            ))}
          </nav>
          {signedIn ? (
            <InterceptAccountMenu name={u?.name} email={u?.email} image={u?.image} isChair={u?.isChair} isEvaluator={u?.isEvaluator} />
          ) : (
            <div className="flex items-center gap-4">
              <a href="/intercept/profile" className="font-mono text-[11px] uppercase tracking-widest text-neutral-400 transition-colors hover:text-white">Sign in</a>
              <a href="#signup" className="border border-[#FF7A00] px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-[#FF7A00] transition-colors hover:bg-[#FF7A00] hover:text-black">
                [ Submit Interest ]
              </a>
            </div>
          )}
        </div>
      </header>

      <main id="top" className="relative z-10">
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-neutral-900">
          <div className="mx-auto max-w-6xl px-6 py-28 text-center sm:py-36">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/light.svg" alt="AARM" className="mx-auto mb-5 h-5 w-auto opacity-90 sm:h-6" />
            <div className="mb-6 font-mono text-[11px] uppercase tracking-[0.4em] text-neutral-500">The AARM Conference</div>
            <h1 className="mx-auto leading-[1.15] text-white" style={{ fontFamily: "var(--font-pixel)", fontSize: "clamp(2.2rem, 9vw, 6rem)" }}>
              INTERCEPT
            </h1>
            <p className="mx-auto mt-8 max-w-xl font-mono text-base text-neutral-300 sm:text-lg">
              {EVENT.tagline}
            </p>
            <div className="mx-auto mt-8 inline-block border border-neutral-700 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-neutral-400">
              {EVENT.dateStamp} // {EVENT.location}
            </div>
            <div className="mt-10">
              <a href="#signup" className="inline-block border-2 border-[#FF7A00] bg-[#FF7A00] px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-black transition-colors hover:bg-transparent hover:text-[#FF7A00]">
                [ Submit Interest ]
              </a>
            </div>
          </div>
        </section>

        {/* Submit interest */}
        <Section id="signup" kicker="Get on the list" title="SUBMIT INTEREST">
          <p className="mb-8 max-w-2xl font-mono text-sm text-neutral-400">
            Register your interest in INTERCEPT — builders, breakers, and defenders all welcome.
            We&apos;ll email you with the details as they land.
          </p>
          <div className="max-w-xl"><InterceptSignup /></div>
        </Section>

        {/* Program */}
        <Section id="program" kicker="One day, four zones" title="PROGRAM">
          <div className="mb-10 grid gap-4 sm:grid-cols-3">
            {PROGRAM.zones.map((z) => (
              <div key={z.key} className="border border-neutral-800 bg-neutral-950 p-5">
                <div className="mb-2 font-mono text-xs uppercase tracking-widest" style={{ color: AMBER }}>{z.label}</div>
                <p className="font-mono text-sm text-neutral-400">{z.desc}</p>
              </div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <TrackColumn title="BUILDERS" color={GREEN} rows={PROGRAM.tracks.builders} />
            <TrackColumn title="BREAKERS" color={RED} rows={PROGRAM.tracks.breakers} />
            <TrackColumn title="DEFENDERS" color={AMBER} rows={PROGRAM.tracks.defenders} />
          </div>
          <p className="mt-4 font-mono text-xs text-neutral-600">
            ✛ Sessions within each track are curated and run by AARM member companies. Slots open.
          </p>
        </Section>

        {/* Insecure Agents Live */}
        <Section id="live" kicker="Marquee session" title="INSECURE AGENTS · LIVE">
          <div className="border border-neutral-800 bg-neutral-950 p-8">
            <p className="max-w-2xl font-mono text-sm text-neutral-300">
              A live taping of the <span className="text-white">Insecure Agents</span> podcast, hosted by
              Allie Howe — real agents, real failures, on stage, in front of a live audience.
            </p>
          </div>
        </Section>

        {/* Emcee */}
        <Section id="emcee" kicker="Your host" title="EMCEE">
          <BadgeCard s={EMCEE} accent={AMBER} big />
        </Section>

        {/* Speakers */}
        <Section id="speakers" kicker="On stage" title="SPEAKERS">
          <ComingSoon label="Speakers announced from the Call for Papers" />
        </Section>

        {/* Review panel / evaluators */}
        <Section id="panel" kicker="Blind review panel" title="EVALUATORS">
          {evaluators.length === 0 ? (
            <ComingSoon label="Review panel announced soon" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {evaluators.map((e, i) => (
                <div key={i} className="border border-neutral-800 bg-neutral-950 p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center border border-[#FF7A00] font-mono text-sm font-bold text-[#FF7A00]">
                      {(e.name || "?").split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0">
                      <div className="font-mono text-sm font-bold text-white">{e.name}</div>
                      {e.title && <div className="mt-0.5 font-mono text-xs text-neutral-500">{e.title}</div>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Sponsors */}
        <Section id="sponsors" kicker="Exhibitor expo" title="SPONSORS">
          <ComingSoon label="Sponsor & exhibitor slots open — get in touch" />
        </Section>

        {/* Call for Papers */}
        <Section id="cfp" kicker="Speak at INTERCEPT" title="CALL FOR PAPERS">
          <div className="max-w-2xl space-y-4">
            <p className="font-mono text-sm text-neutral-300">
              Talks are selected through a <span className="text-white">blind peer review</span>.
              Submit an anonymized proposal — the review panel scores it without seeing who you are.
            </p>
            <p className="font-mono text-sm text-neutral-500">
              Sign in, build your speaker profile, and submit your paper across three sections.
              Selected speakers are announced ahead of the event.
            </p>
            <p className="font-mono text-sm text-neutral-500">
              Papers must be submitted as IEEE conference papers (PDF), formatted with the{" "}
              <a href="https://www.overleaf.com/latex/templates/ieee-conference-template/grfzhhncsfqn" target="_blank" rel="noopener noreferrer" className="text-[#FF7A00] underline hover:text-white">
                Overleaf IEEE conference template ↗
              </a>.
            </p>
          </div>
          {/* Timeline */}
          <div className="mt-10">
            <div className="mb-4 font-mono text-[10px] uppercase tracking-[0.3em] text-neutral-500">Timeline</div>
            <div className="border-l border-neutral-800">
              {[
                { phase: "Submissions open now", window: "Closes December 31, 2026", color: GREEN },
                { phase: "Blind review", window: "January 2027", color: AMBER },
                { phase: "Accept / reject notifications", window: "By late January 2027", color: RED },
              ].map((t) => (
                <div key={t.phase} className="relative pl-6 pb-6 last:pb-0">
                  <span className="absolute left-0 top-1.5 -translate-x-1/2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <div className="font-mono text-sm text-white">{t.phase}</div>
                  <div className="mt-0.5 font-mono text-xs text-neutral-500">{t.window}</div>
                </div>
              ))}
            </div>
            <p className="mt-3 font-mono text-xs text-neutral-600">✛ Some papers may be selected on a rolling basis before the deadline.</p>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <a
              href="/intercept/cfp"
              className="inline-block border-2 border-[#FF7A00] bg-[#FF7A00] px-8 py-4 font-mono text-sm font-bold uppercase tracking-[0.2em] text-black transition-colors hover:bg-transparent hover:text-[#FF7A00]"
            >
              [ Submit a Paper ]
            </a>
            <a href="/intercept/call-for-papers" className="font-mono text-sm uppercase tracking-widest text-neutral-400 underline transition-colors hover:text-white">
              Read the full call →
            </a>
          </div>
        </Section>

      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-900 px-6 py-14">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-center">
          <div className="text-sm text-white" style={{ fontFamily: "var(--font-pixel)" }}>INTERCEPT</div>
          <div className="font-mono text-xs uppercase tracking-[0.2em] text-neutral-500">{EVENT.dateStamp} // {EVENT.location}</div>
          <a href={EVENT.aarmUrl} className="font-mono text-xs uppercase tracking-widest text-neutral-400 hover:text-[#FF7A00]">aarm.dev ↗</a>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="border-b border-neutral-900 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8">
          <div className="mb-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.3em] text-neutral-500">
            <span style={{ color: AMBER }}>✛</span> {kicker}
          </div>
          <h2 className="text-white" style={{ fontFamily: "var(--font-pixel)", fontSize: "clamp(1.1rem, 3.5vw, 1.9rem)" }}>{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 border border-dashed border-neutral-800 py-16 text-center">
      <div className="font-mono text-sm font-bold uppercase tracking-[0.3em] text-[#FF7A00]">Coming soon</div>
      <div className="font-mono text-xs text-neutral-500">{label}</div>
    </div>
  );
}

function TrackColumn({ title, color, rows }: { title: string; color: string; rows: { time: string; title: string; by: string }[] }) {
  return (
    <div className="border border-neutral-800">
      <div className="border-b border-neutral-800 px-5 py-3 font-mono text-sm font-bold uppercase tracking-widest" style={{ color }}>{title}</div>
      <div className="divide-y divide-neutral-900">
        {rows.map((r, i) => (
          <div key={i} className="px-5 py-4">
            <div className="font-mono text-[11px] uppercase tracking-widest text-neutral-600">{r.time}</div>
            <div className="mt-1 font-mono text-sm text-neutral-300">{r.title}</div>
            <div className="mt-0.5 font-mono text-xs text-neutral-600">{r.by}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BadgeCard({ s, accent, big }: { s: (typeof SPEAKERS)[number]; accent: string; big?: boolean }) {
  const initials = s.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return (
    <div className={`relative border border-neutral-800 bg-neutral-950 ${big ? "flex flex-col gap-4 p-6 sm:flex-row sm:items-center" : "p-5"}`}>
      <div className="flex items-center gap-4">
        <div className={`flex ${big ? "h-20 w-20" : "h-14 w-14"} shrink-0 items-center justify-center border font-mono font-bold`} style={{ borderColor: accent, color: accent }}>
          {s.photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.photo} alt={s.name} className="h-full w-full object-cover" />
          ) : (
            <span className={big ? "text-xl" : "text-sm"}>{s.placeholder ? "?" : initials}</span>
          )}
        </div>
        <div className="min-w-0">
          <div className="font-mono text-sm font-bold text-white">{s.name}</div>
          <div className="mt-0.5 font-mono text-xs text-neutral-400">{s.title}</div>
          <div className="mt-0.5 font-mono text-xs text-neutral-600">{s.company}</div>
        </div>
      </div>
      {s.track && s.track !== "emcee" && (
        <span className="absolute right-3 top-3 font-mono text-[9px] uppercase tracking-widest" style={{ color: accent }}>{s.track}</span>
      )}
    </div>
  );
}
