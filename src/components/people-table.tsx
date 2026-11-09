"use client";

import { useState, useTransition } from "react";
import { setUserRole } from "@/lib/actions";

type Person = { id: string; name: string | null; email: string | null; isAdmin: boolean | null; isChair: boolean | null; isEvaluator: boolean | null };

export function PeopleTable({ people }: { people: Person[] }) {
  const [rows, setRows] = useState(people);
  const [pending, start] = useTransition();

  function toggle(id: string, patch: { isEvaluator?: boolean; isChair?: boolean }) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    start(async () => { await setUserRole(id, patch); });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-neutral-100">
      <table className="w-full min-w-[620px] text-sm">
        <thead className="bg-neutral-50">
          <tr className="border-b border-neutral-100">
            {["User", "Email", "Evaluator", "Chair", "Admin"].map((h) => (
              <th key={h} className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-widest text-neutral-400">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id} className="border-b border-neutral-50 last:border-0">
              <td className="px-4 py-2.5 font-medium text-neutral-800">{p.name || "—"}</td>
              <td className="px-4 py-2.5 text-neutral-500">{p.email || "—"}</td>
              <td className="px-4 py-2.5">
                <input type="checkbox" disabled={pending} checked={!!p.isEvaluator} onChange={(e) => toggle(p.id, { isEvaluator: e.target.checked })} className="h-4 w-4 accent-blue-600" />
              </td>
              <td className="px-4 py-2.5">
                <input type="checkbox" disabled={pending} checked={!!p.isChair} onChange={(e) => toggle(p.id, { isChair: e.target.checked })} className="h-4 w-4 accent-neutral-900" />
              </td>
              <td className="px-4 py-2.5 font-mono text-[11px] uppercase text-neutral-400">{p.isAdmin ? "yes" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
