export type EventStatus = "upcoming" | "coming-soon" | "past";
export type EventTag = "Conference" | "Summit" | "Community" | "Meetup";

export type AARMEvent = {
  id: string;
  name: string;
  url?: string;
  /** Human-readable date shown in the UI, e.g. "August 2026" */
  dateLabel: string;
  /** ISO start date — used for ordering. Undated events sort first (treated as imminent/TBD). */
  startISO?: string;
  /** ISO date after which the event is considered over and auto-moves to Past. */
  endISO?: string;
  location?: string;
  description?: string;
  /** No firm date yet — always rendered in the "Coming soon" section. */
  comingSoon?: boolean;
  /** Force into "Past" — for undated events that have already happened. */
  past?: boolean;
  /** Promote ahead of other upcoming events — spotlight banner + top of the list. */
  featured?: boolean;
  /** Optional label used only in the homepage spotlight banner (falls back to name). */
  bannerLabel?: string;
  tag: EventTag;
};

export const EVENTS: AARMEvent[] = [
  {
    id: "aarm-intercept-demo-night",
    name: "AARM Intercept Demo Night",
    url: "https://luma.com/vanta-zg62",
    dateLabel: "October 21, 2026",
    startISO: "2026-10-21",
    endISO: "2026-10-21",
    location: "San Francisco, CA",
    description:
      "An evening on securing AI agents once they start taking action in real systems — an intro to AARM, a panel on agentic runtime security for incident management, seven lightning demos, then networking and drinks. Hosted by Vanta, Insecure Agents, and Keycard, following the CSA Agentic AI Security Summit.",
    tag: "Community",
    featured: true,
  },
  {
    id: "intercept-2026",
    name: "INTERCEPT 2026",
    bannerLabel: "INTERCEPT — The AARM Conference",
    url: "/intercept",
    dateLabel: "February 2027",
    startISO: "2027-02-01",
    endISO: "2027-02-28",
    location: "San Francisco, CA",
    description:
      "The inaugural INTERCEPT — a one-day event on intercepting and controlling AI agents at runtime. Talks are chosen through an open call for papers and blind peer review.",
    tag: "Conference",
    featured: true,
  },
  {
    id: "aauth-night",
    name: "AAuth Night: Moving Beyond OAuth",
    url: "https://luma.com/a2h25m60?utm_source=aarm.dev",
    dateLabel: "2026",
    // No public date yet — undated events sort first so this stays the spotlight.
    // Add startISO + endISO when the date is confirmed and ordering/auto-past kicks in.
    location: "111 Minna St, San Francisco, CA",
    description:
      "An evening exploring authentication challenges for AI agents — featuring talks and demos on AAuth, a new auth protocol for agents built by OAuth author Dick Hardt. Topics include running agents without API keys, mission-bounded authority, multi-agent delegation, and production authentication patterns.",
    tag: "Community",
    past: true,
  },
  {
    id: "noma-aarm-webinar",
    name: "Governing Agentic AI: The AARM Standard in Practice",
    url: "https://noma.security/webinars/governing-agentic-ai-the-aarm-standard-in-practice/",
    dateLabel: "Online webinar",
    // Add startISO + endISO once the broadcast date is confirmed.
    location: "Online · hosted by Noma Security",
    description:
      "A fireside webinar on runtime security for AI agents — the AARM specification's requirements, what conformance demonstrates, and practical strategies for enterprise teams to start governing autonomous AI today.",
    tag: "Community",
    past: true,
  },
  {
    id: "blackhat-ciso-summit-2026",
    name: "Black Hat CISO Summit 2026",
    url: "https://www.blackhat.com/us-26/summit-sessions/schedule/index.html?track[]=ciso-summit#the-ai-arms-race-from-governance-to-runtime-control-in-an-autonomous-threat-landscape-55609",
    dateLabel: "August 2026",
    startISO: "2026-08-01",
    endISO: "2026-08-31",
    location: "Las Vegas, NV",
    description:
      "AARM featured at the Black Hat CISO Summit — session: \"The AI Arms Race: From Governance to Runtime Control in an Autonomous Threat Landscape.\"",
    tag: "Summit",
  },
  {
    id: "aarm-con",
    name: "AARM Con",
    dateLabel: "Fall 2026",
    comingSoon: true,
    description:
      "The first dedicated conference for AI agent runtime security. Details coming soon.",
    tag: "Conference",
  },
];

/** Derive an event's status from the current date. */
export function eventStatus(e: AARMEvent, now: Date = new Date()): EventStatus {
  if (e.past) return "past";
  if (e.comingSoon) return "coming-soon";
  const end = e.endISO ?? e.startISO;
  if (end && new Date(end).getTime() < now.getTime()) return "past";
  return "upcoming";
}

/** Sort key: undated events first (imminent/TBD), then by start date ascending. */
function startKey(e: AARMEvent): number {
  return e.startISO ? new Date(e.startISO).getTime() : -Infinity;
}

export function getEventsByStatus(now: Date = new Date()) {
  const sorted = [...EVENTS].sort((a, b) => startKey(a) - startKey(b));
  return {
    // Featured events lead; otherwise soonest first (stable sort keeps date order).
    upcoming: sorted
      .filter((e) => eventStatus(e, now) === "upcoming")
      .sort((a, b) => Number(!!b.featured) - Number(!!a.featured)),
    comingSoon: sorted.filter((e) => eventStatus(e, now) === "coming-soon"),
    // Past sorted most-recent first.
    past: sorted
      .filter((e) => eventStatus(e, now) === "past")
      .sort((a, b) => startKey(b) - startKey(a)),
  };
}

/** The single event promoted to the homepage banner: the featured event, else the soonest upcoming. */
export function getSpotlightEvent(now: Date = new Date()): AARMEvent | null {
  const { upcoming } = getEventsByStatus(now);
  return upcoming.find((e) => e.featured) ?? upcoming[0] ?? null;
}
