"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { BuilderRow } from "@/db/schema";
import { BuilderLogo } from "@/components/builder-logo";
import {
  SURFACES, STAGES, TYPES, AUDIENCES, DEPLOYMENTS, INTERCEPTION_ARCHITECTURES, POLICY_MODELS,
} from "@/db/taxonomy";

function isConformant(b: BuilderRow) {
  return b.conformanceLevel === "core" || b.conformanceLevel === "extended";
}
function confRank(b: BuilderRow) {
  return b.conformanceLevel === "extended" ? 2 : b.conformanceLevel === "core" ? 1 : 0;
}

type SortKey = "default" | "name" | "conformance";
type SortDir = "asc" | "desc";

// One accent axis: conformance. Extended = brand blue, Core = green, Aligned = neutral.
function ConfBadge({ b }: { b: BuilderRow }) {
  const base = "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide";
  if (b.conformanceLevel === "extended") return <span className={`${base} border-[#1A6EB5]/25 bg-[#EEF4FF] text-[#155A96]`}><Dot c="#1A6EB5" />Extended</span>;
  if (b.conformanceLevel === "core") return <span className={`${base} border-green-600/25 bg-green-50 text-green-800`}><Dot c="#16A34A" />Core</span>;
  return <span className={`${base} border-neutral-200 bg-neutral-50 text-neutral-500`}>Aligned</span>;
}
function Dot({ c }: { c: string }) {
  return <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: c }} />;
}

// Everything else is a single restrained neutral chip — no rainbow.
const CHIP = "whitespace-nowrap rounded-md border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600";

// Policy model is the one genuinely categorical axis, so it keeps a soft tint.
const POLICY_TONES: Record<string, string> = {
  Deterministic: "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Non-deterministic": "border-rose-200 bg-rose-50 text-rose-700",
  Hybrid: "border-amber-200 bg-amber-50 text-amber-700",
};
function PolicyPill({ value }: { value: string }) {
  return (
    <span className={`whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${POLICY_TONES[value] ?? "border-neutral-200 bg-neutral-50 text-neutral-600"}`}>
      {value}
    </span>
  );
}

function Chips({ items }: { items?: string[] | null; tone?: string }) {
  if (!items || items.length === 0) return <span className="text-neutral-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s) => (
        <span key={s} className={CHIP}>{s}</span>
      ))}
    </div>
  );
}

export function BuilderRegistry({ builders }: { builders: BuilderRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [conf, setConf] = useState("");
  const [stage, setStage] = useState("");
  const [type, setType] = useState("");
  const [target, setTarget] = useState("");
  const [coverage, setCoverage] = useState("");
  const [deployment, setDeployment] = useState("");
  const [interception, setInterception] = useState("");
  const [policy, setPolicy] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("default");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [comparing, setComparing] = useState(false);
  const [tailOrder, setTailOrder] = useState<string[] | null>(null);

  // Shuffle the non-featured aligned tail once per page load (after mount, so
  // it matches SSR on first paint and avoids a hydration mismatch).
  useEffect(() => {
    const ids = builders.filter((b) => !isConformant(b) && !b.featured).map((b) => b.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setTailOrder(ids);
  }, [builders]);

  const MAX_COMPARE = 4;
  function toggleSelect(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length >= MAX_COMPARE ? s : [...s, id]));
  }
  const selectedBuilders = builders.filter((b) => selected.includes(b.id));

  const facets: { key: string; label: string; value: string; set: (v: string) => void; options: [string, string][] }[] = [
    { key: "conf", label: "Conformance", value: conf, set: setConf, options: [["conformant", "Conformant"], ["aligned", "Aligned"]] },
    { key: "stage", label: "Stage", value: stage, set: setStage, options: STAGES.map((s) => [s, s]) },
    { key: "type", label: "Type", value: type, set: setType, options: TYPES.map((s) => [s, s]) },
    { key: "target", label: "Target", value: target, set: setTarget, options: AUDIENCES.map((s) => [s, s]) },
    { key: "coverage", label: "Coverage", value: coverage, set: setCoverage, options: SURFACES.map((s) => [s, s]) },
    { key: "deployment", label: "Deployment", value: deployment, set: setDeployment, options: DEPLOYMENTS.map((s) => [s, s]) },
    { key: "interception", label: "Interception", value: interception, set: setInterception, options: INTERCEPTION_ARCHITECTURES.map((s) => [s, s]) },
    { key: "policy", label: "Policy", value: policy, set: setPolicy, options: POLICY_MODELS.map((s) => [s, s]) },
  ];

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir(key === "name" ? "asc" : "desc"); }
  }

  const has = (arr: string[] | null | undefined, v: string) => !v || (arr ?? []).includes(v as never);

  const rows = useMemo(() => {
    const q = search.toLowerCase();
    const filtered = builders.filter((b) => {
      if (q && !b.name.toLowerCase().includes(q) && !(b.description ?? "").toLowerCase().includes(q)) return false;
      if (conf === "conformant" && !isConformant(b)) return false;
      if (conf === "aligned" && isConformant(b)) return false;
      if (stage && b.stage !== stage) return false;
      if (policy && b.policyModel !== policy) return false;
      if (!has(b.types, type)) return false;
      if (!has(b.audiences, target)) return false;
      if (!has(b.surfaces, coverage)) return false;
      if (!has(b.deployments, deployment)) return false;
      if (!has(b.interception, interception)) return false;
      return true;
    });
    // Default = server ranking (Extended → Core → featured Aligned), with the
    // non-featured aligned tail reshuffled client-side per load.
    if (sortKey === "default") {
      if (!tailOrder) return filtered;
      const rank = new Map(tailOrder.map((id, i) => [id, i]));
      const head = filtered.filter((b) => isConformant(b) || b.featured);
      const tail = filtered
        .filter((b) => !isConformant(b) && !b.featured)
        .sort((a, b) => (rank.get(a.id) ?? 0) - (rank.get(b.id) ?? 0));
      return [...head, ...tail];
    }
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const cmp = sortKey === "name"
        ? a.name.localeCompare(b.name)
        : confRank(a) - confRank(b) || (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
      return cmp * dir;
    });
  }, [builders, search, conf, stage, type, target, coverage, deployment, interception, policy, sortKey, sortDir, tailOrder]);

  const activeCount = [conf, stage, type, target, coverage, deployment, interception, policy].filter(Boolean).length;
  const dirty = !!search || activeCount > 0 || sortKey !== "default";

  function clearAll() {
    setSearch(""); setConf(""); setStage(""); setType(""); setTarget("");
    setCoverage(""); setDeployment(""); setInterception(""); setPolicy(""); setSortKey("default");
  }

  return (
    <div>
      {/* Toolbar — search + a single Filters toggle, with active filters as chips */}
      <div className="mb-5">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="7" /><path strokeLinecap="round" d="M21 21l-4-4" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search builders…"
              className="h-10 w-full rounded-xl border border-neutral-200 bg-white pl-9 pr-3 text-sm text-neutral-800 placeholder-neutral-400 shadow-sm outline-none transition-colors focus:border-neutral-400"
            />
          </div>
          <button
            onClick={() => setOpen((o) => !o)}
            className={`flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium shadow-sm transition-colors ${
              open || activeCount ? "border-blue-300 bg-blue-50 text-blue-800" : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18M6 12h12M10 19h4" />
            </svg>
            Filters
            {activeCount > 0 && <span className="rounded-full bg-blue-600 px-1.5 text-[11px] font-bold text-white">{activeCount}</span>}
          </button>
          <span className="hidden font-mono text-xs text-neutral-400 sm:block">{rows.length}/{builders.length}</span>
        </div>

        {/* Active filter chips */}
        {activeCount > 0 && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {facets.filter((f) => f.value).map((f) => (
              <button
                key={f.key}
                onClick={() => f.set("")}
                className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 py-0.5 pl-2.5 pr-1.5 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-100"
              >
                <span className="text-blue-500">{f.label}:</span>
                {f.options.find((o) => o[0] === f.value)?.[1] ?? f.value}
                <span className="text-blue-400">✕</span>
              </button>
            ))}
            <button onClick={clearAll} className="ml-1 text-xs font-medium text-neutral-400 hover:text-neutral-700">Clear all</button>
          </div>
        )}

        {/* Filter panel (collapsed by default) */}
        {open && (
          <div className="mt-2.5 flex flex-wrap gap-2 rounded-2xl border border-neutral-200/70 bg-neutral-50/60 p-3">
            {facets.map((f) => (
              <FilterMenu key={f.key} label={f.label} value={f.value} onChange={f.set} options={f.options} />
            ))}
          </div>
        )}
      </div>

      {/* Data grid — table on desktop, cards on small screens */}
      <div className="hidden overflow-x-auto rounded-2xl border border-neutral-200 shadow-sm md:block">
        <table className="w-full min-w-[1080px] text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50/80">
              <th className="w-10 px-4 py-3"></th>
              <SortTh label="Company" onClick={() => toggleSort("name")} active={sortKey === "name"} dir={sortDir} />
              <SortTh label="Conformance" onClick={() => toggleSort("conformance")} active={sortKey === "conformance"} dir={sortDir} />
              {["Stage", "Type", "Target", "Coverage", "Deployment", "Interception", "Policy"].map((h) => (
                <th key={h} className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr
                key={b.id}
                onClick={() => router.push(`/builders/${b.slug}`)}
                className="group cursor-pointer border-b border-neutral-100 transition-colors last:border-0 hover:bg-[#EEF4FF]/60"
              >
                <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selected.includes(b.id)}
                    onChange={() => toggleSelect(b.id)}
                    disabled={!selected.includes(b.id) && selected.length >= MAX_COMPARE}
                    className="h-4 w-4 accent-[#1A6EB5] disabled:opacity-30"
                    aria-label={`Select ${b.name} to compare`}
                  />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <BuilderLogo name={b.name} domain={b.domain} logoUrl={b.logoUrl} imgSize={20} className="h-9 w-9 shrink-0 rounded-lg border border-neutral-200 bg-white" />
                    <div className="min-w-0">
                      <div className="font-semibold text-neutral-900 group-hover:text-[#1A6EB5]">{b.name}</div>
                      <div className="truncate text-xs text-neutral-400">{b.domain}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><ConfBadge b={b} /></td>
                <td className="px-4 py-3 text-neutral-600">{b.stage || <span className="text-neutral-300">—</span>}</td>
                <td className="px-4 py-3"><Chips items={b.types} /></td>
                <td className="px-4 py-3"><Chips items={b.audiences} /></td>
                <td className="px-4 py-3"><Chips items={b.surfaces} /></td>
                <td className="px-4 py-3"><Chips items={b.deployments} /></td>
                <td className="px-4 py-3"><Chips items={b.interception} /></td>
                <td className="px-4 py-3">{b.policyModel ? <PolicyPill value={b.policyModel} /> : <span className="text-neutral-300">—</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <EmptyState dirty={dirty} clearAll={clearAll} />}
      </div>

      {/* Card list — small screens */}
      <div className="space-y-3 md:hidden">
        {rows.map((b) => (
          <div
            key={b.id}
            onClick={() => router.push(`/builders/${b.slug}`)}
            className="cursor-pointer rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm transition-colors active:bg-neutral-50"
          >
            <div className="flex items-start gap-3">
              <BuilderLogo name={b.name} domain={b.domain} logoUrl={b.logoUrl} imgSize={22} className="h-11 w-11 shrink-0 rounded-xl border border-neutral-200 bg-white" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div className="truncate font-semibold text-neutral-900">{b.name}</div>
                  <label onClick={(e) => e.stopPropagation()} className="shrink-0">
                    <input
                      type="checkbox"
                      checked={selected.includes(b.id)}
                      onChange={() => toggleSelect(b.id)}
                      disabled={!selected.includes(b.id) && selected.length >= MAX_COMPARE}
                      className="h-4 w-4 accent-[#1A6EB5] disabled:opacity-30"
                      aria-label={`Select ${b.name} to compare`}
                    />
                  </label>
                </div>
                <div className="truncate text-xs text-neutral-400">{b.domain}</div>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <ConfBadge b={b} />
                  {b.stage && <span className={CHIP}>{b.stage}</span>}
                  {b.policyModel && <PolicyPill value={b.policyModel} />}
                </div>
                {(b.surfaces?.length ?? 0) > 0 && (
                  <div className="mt-2"><Chips items={b.surfaces} /></div>
                )}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm">
            <EmptyState dirty={dirty} clearAll={clearAll} />
          </div>
        )}
      </div>

      {/* Floating compare bar */}
      {selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="flex items-center gap-3 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 shadow-xl">
            <span className="text-sm text-neutral-600">
              <span className="font-semibold text-neutral-900">{selected.length}</span> selected
              {selected.length >= MAX_COMPARE && <span className="ml-1 text-xs text-neutral-400">(max)</span>}
            </span>
            <button onClick={() => setSelected([])} className="text-sm text-neutral-400 hover:text-neutral-700">Clear</button>
            <button
              onClick={() => setComparing(true)}
              disabled={selected.length < 2}
              className="rounded-xl px-4 py-2 text-sm font-bold text-white transition-opacity hover:opacity-85 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, #1A6EB5 0%, #1E4FA0 100%)" }}
            >
              Compare{selected.length >= 2 ? ` ${selected.length}` : ""}
            </button>
          </div>
        </div>
      )}

      {comparing && <CompareModal builders={selectedBuilders} onClose={() => setComparing(false)} />}
    </div>
  );
}

const COMPARE_REQS = [
  ["R1", "Pre-execution interception"], ["R2", "Context accumulation"],
  ["R3", "Policy + intent alignment"], ["R4", "Five decisions"],
  ["R5", "Tamper-evident receipts"], ["R6", "Identity binding"],
  ["R7", "Semantic drift tracking"], ["R8", "Telemetry export"],
  ["R9", "Least-privilege"],
] as const;

function CompareModal({ builders, onClose }: { builders: BuilderRow[]; onClose: () => void }) {
  const confText = (b: BuilderRow) =>
    b.conformanceLevel === "extended" ? "Extended (R1–R9)" : b.conformanceLevel === "core" ? "Core (R1–R6)" : "Aligned";

  const rows: { label: string; render: (b: BuilderRow) => React.ReactNode }[] = [
    { label: "Conformance", render: (b) => confText(b) },
    { label: "Stage", render: (b) => b.stage || dash },
    { label: "Type", render: (b) => list(b.types, "type") },
    { label: "Target", render: (b) => list(b.audiences, "target") },
    { label: "Coverage", render: (b) => list(b.surfaces, "coverage") },
    { label: "Deployment", render: (b) => list(b.deployments, "deployment") },
    { label: "Interception", render: (b) => list(b.interception, "interception") },
    { label: "Policy", render: (b) => (b.policyModel ? <PolicyPill value={b.policyModel} /> : dash) },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-4xl overflow-auto rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-neutral-100 bg-white px-6 py-4">
          <h2 className="text-lg font-bold tracking-tight text-neutral-900">Compare builders</h2>
          <button onClick={onClose} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="overflow-x-auto p-2">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="w-40 px-4 py-3" />
                {builders.map((b) => (
                  <th key={b.id} className="min-w-[160px] px-4 py-3 text-left align-bottom">
                    <a href={`/builders/${b.slug}`} className="flex items-center gap-2 font-semibold text-neutral-900 hover:text-[#1A6EB5]">
                      <BuilderLogo name={b.name} domain={b.domain} logoUrl={b.logoUrl} imgSize={16} className="h-6 w-6 shrink-0 rounded-md border border-neutral-200 bg-white" />
                      {b.name}
                    </a>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-neutral-400 align-top">{r.label}</td>
                  {builders.map((b) => (
                    <td key={b.id} className="px-4 py-3 align-top text-neutral-700">{r.render(b)}</td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-neutral-200">
                <td colSpan={builders.length + 1} className="px-4 pt-4 pb-1 font-mono text-[10px] uppercase tracking-widest text-neutral-400">Requirement coverage</td>
              </tr>
              {COMPARE_REQS.map(([id, title]) => (
                <tr key={id} className="border-t border-neutral-50">
                  <td className="px-4 py-2 align-top text-neutral-600"><code className="text-xs font-bold" style={{ color: "#1A6EB5" }}>{id}</code> <span className="text-xs text-neutral-400">{title}</span></td>
                  {builders.map((b) => {
                    const st = b.requirements?.find((x) => x.id === id)?.status;
                    return (
                      <td key={b.id} className="px-4 py-2 align-top">
                        {st === "pass" ? <span className="text-green-600">✓</span> : st === "fail" ? <span className="text-red-500">✕</span> : <span className="text-neutral-300">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const dash = <span className="text-neutral-300">—</span>;
function list(items?: string[] | null, _tone?: string) {
  if (!items || items.length === 0) return dash;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((s) => <span key={s} className={CHIP}>{s}</span>)}
    </div>
  );
}

function EmptyState({ dirty, clearAll }: { dirty: boolean; clearAll: () => void }) {
  return (
    <div className="py-20 text-center">
      <p className="font-mono text-sm text-neutral-400">No builders match these filters.</p>
      {dirty && <button onClick={clearAll} className="mt-3 text-sm font-semibold" style={{ color: "#1A6EB5" }}>Clear filters</button>}
    </div>
  );
}

function SortTh({ label, onClick, active, dir }: { label: string; onClick: () => void; active: boolean; dir: SortDir }) {
  return (
    <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">
      <button onClick={onClick} className="flex items-center gap-1 transition-colors hover:text-neutral-700">
        {label}
        <span className={active ? "text-neutral-700" : "text-neutral-300"}>{active && dir === "asc" ? "▲" : "▼"}</span>
      </button>
    </th>
  );
}

function FilterMenu({
  label, value, onChange, options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = value !== "";
  const current = options.find((o) => o[0] === value)?.[1];

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm shadow-sm transition-colors ${
          active
            ? "border-blue-300 bg-blue-50 font-medium text-blue-800"
            : "border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50"
        }`}
      >
        {active ? `${label}: ${current}` : label}
        <svg className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""} ${active ? "text-blue-500" : "text-neutral-400"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1.5 min-w-[200px] rounded-xl border border-neutral-200 bg-white p-1 shadow-lg">
          <MenuRow selected={!value} onClick={() => { onChange(""); setOpen(false); }}>Any {label.toLowerCase()}</MenuRow>
          <div className="my-1 h-px bg-neutral-100" />
          {options.map(([v, l]) => (
            <MenuRow key={v} selected={value === v} onClick={() => { onChange(v); setOpen(false); }}>{l}</MenuRow>
          ))}
        </div>
      )}
    </div>
  );
}

function MenuRow({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors hover:bg-neutral-100 ${
        selected ? "font-medium text-neutral-900" : "text-neutral-600"
      }`}
    >
      <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center" style={{ color: "#1A6EB5" }}>
        {selected && (
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}
