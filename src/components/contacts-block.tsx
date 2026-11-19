"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { Button } from "@/components/ui/button";

// How many contacts a block shows before "Показать всех"
const PREVIEW_COUNT = 5;

export type ContactsBlockRow = {
  id: number;
  name: string;
  // Formatted on the server, e.g. "Раз в месяц · последняя заметка 3 апреля 2026 г."
  details: string;
};

// A block of contacts above the list, such as "Пора связаться" or "Скоро день рождения":
// the first five rows, the rest behind "Показать всех"
export function ContactsBlock({
  title,
  testId,
  rows,
}: {
  title: string;
  // "reach-out": the block is "reach-out", each row "reach-out-row"
  testId: string;
  rows: ContactsBlockRow[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? rows : rows.slice(0, PREVIEW_COUNT);
  const headingId = useId();

  return (
    <section
      aria-labelledby={headingId}
      className="mb-4 overflow-clip rounded-xl bg-card ring-1 ring-foreground/10"
      data-testid={testId}
    >
      <h2
        id={headingId}
        className="border-b border-glass-border px-5 pt-4 pb-3 font-heading text-xl font-bold tracking-heading sm:text-2xl"
      >
        {title}
      </h2>
      <ul className="divide-y divide-glass-border">
        {visible.map((row) => (
          <li key={row.id} data-testid={`${testId}-row`}>
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
      {!expanded && rows.length > PREVIEW_COUNT && (
        <div className="border-t border-glass-border p-2">
          <Button variant="ghost" className="w-full text-accent" onClick={() => setExpanded(true)}>
            Показать всех ({rows.length})
          </Button>
        </div>
      )}
    </section>
  );
}
