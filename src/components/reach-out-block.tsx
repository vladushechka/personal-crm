"use client";

import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { REACH_OUT_PREVIEW_COUNT } from "@/lib/keep-in-touch";

export type ReachOutRow = {
  id: number;
  name: string;
  // Formatted on the server, e.g. "Раз в месяц · последняя заметка 3 апреля 2026 г."
  details: string;
};

// "Пора связаться": the most overdue contacts first, the rest behind "Показать всех"
export function ReachOutBlock({ rows }: { rows: ReachOutRow[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, REACH_OUT_PREVIEW_COUNT);

  return (
    <section
      aria-labelledby="reach-out-heading"
      className="mb-4 overflow-clip rounded-xl bg-card ring-1 ring-foreground/10"
      data-testid="reach-out"
    >
      <h2
        id="reach-out-heading"
        className="border-b border-glass-border px-5 pt-4 pb-3 font-heading text-xl font-bold tracking-heading sm:text-2xl"
      >
        Пора связаться
      </h2>
      <ul className="divide-y divide-glass-border">
        {visible.map((row) => (
          <li key={row.id} data-testid="reach-out-row">
            <Link
              href={`/contacts/${row.id}`}
              className="block px-5 py-3 transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            >
              <span className="block text-base font-semibold">{row.name}</span>
              <span className="mt-0.5 block text-sm text-muted-foreground">{row.details}</span>
            </Link>
          </li>
        ))}
      </ul>
      {!expanded && rows.length > REACH_OUT_PREVIEW_COUNT && (
        <div className="border-t border-glass-border p-2">
          <Button variant="ghost" className="w-full text-accent" onClick={() => setExpanded(true)}>
            Показать всех ({rows.length})
          </Button>
        </div>
      )}
    </section>
  );
}
