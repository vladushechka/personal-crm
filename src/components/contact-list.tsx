import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ContactListItem } from "@/lib/contacts";

export type ContactRowData = ContactListItem & { groupNames: string[] };

type LetterGroup = { letter: string; contacts: ContactRowData[] };

// Contacts arrive sorted by name; split them into sections by first letter
function groupByFirstLetter(contacts: ContactRowData[]): LetterGroup[] {
  const groups: LetterGroup[] = [];
  for (const contact of contacts) {
    const letter = contact.name.charAt(0).toUpperCase() || "#";
    const last = groups.at(-1);
    if (last?.letter === letter) {
      last.contacts.push(contact);
    } else {
      groups.push({ letter, contacts: [contact] });
    }
  }
  return groups;
}

export function contactRowId(id: number) {
  return `contact-${id}`;
}

export function ContactList({
  contacts,
  highlightId,
}: {
  contacts: ContactRowData[];
  highlightId?: number;
}) {
  return (
    <div className="overflow-clip rounded-xl bg-card ring-1 ring-foreground/10">
      {groupByFirstLetter(contacts).map(({ letter, contacts }) => (
        <section key={letter} aria-label={letter}>
          {/* Letters look like the block numbers on the landing */}
          <h2 className="border-y border-glass-border bg-muted px-5 py-1 font-heading text-xl font-semibold text-accent italic first:border-t-0">
            {letter}
          </h2>
          <ul className="divide-y divide-glass-border">
            {contacts.map((contact) => (
              <ContactRow
                key={contact.id}
                contact={contact}
                highlighted={contact.id === highlightId}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function ContactRow({ contact, highlighted }: { contact: ContactRowData; highlighted: boolean }) {
  const details = [contact.about, contact.howWeMet].filter(Boolean).join(" · ");

  return (
    <li id={contactRowId(contact.id)} data-testid="contact-row" className="scroll-mt-32">
      <Link
        href={`/contacts/${contact.id}`}
        className={cn(
          "flex flex-col gap-0.5 px-5 py-3 outline-none hover:bg-muted focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          highlighted && "bg-accent-soft hover:bg-accent-soft",
        )}
      >
        <span className="flex items-center gap-2 text-base font-semibold">
          {contact.name}
          {highlighted && (
            <span className="rounded-sm bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
              Только что добавлен
            </span>
          )}
        </span>
        {details && <span className="truncate text-sm text-muted-foreground">{details}</span>}
        {contact.groupNames.length > 0 && (
          <span className="mt-1 flex flex-wrap gap-1.5">
            {contact.groupNames.map((name) => (
              <span
                key={name}
                data-testid="contact-group"
                className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-xs text-foreground"
              >
                {name}
              </span>
            ))}
          </span>
        )}
      </Link>
    </li>
  );
}
