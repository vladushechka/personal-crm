import Link from "next/link";

import { cn } from "@/lib/utils";
import type { ContactListItem } from "@/lib/contacts";

type LetterGroup = { letter: string; contacts: ContactListItem[] };

// Contacts arrive sorted by name; split them into sections by first letter
function groupByFirstLetter(contacts: ContactListItem[]): LetterGroup[] {
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
  contacts: ContactListItem[];
  highlightId?: number;
}) {
  return (
    <div className="overflow-clip rounded-xl bg-background ring-1 ring-foreground/10">
      {groupByFirstLetter(contacts).map(({ letter, contacts }) => (
        <section key={letter} aria-label={letter}>
          <h2 className="border-y bg-muted/60 px-4 py-1 text-xs font-semibold text-muted-foreground first:border-t-0">
            {letter}
          </h2>
          <ul className="divide-y">
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

function ContactRow({
  contact,
  highlighted,
}: {
  contact: ContactListItem;
  highlighted: boolean;
}) {
  const details = [contact.about, contact.howWeMet].filter(Boolean).join(" · ");

  return (
    <li id={contactRowId(contact.id)} data-testid="contact-row" className="scroll-mt-32">
      <Link
        href={`/contacts/${contact.id}`}
        className={cn(
          "flex flex-col gap-0.5 px-4 py-2.5 outline-none hover:bg-muted/60 focus-visible:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset",
          highlighted && "bg-emerald-50 hover:bg-emerald-100/70 dark:bg-emerald-950/40",
        )}
      >
        <span className="flex items-center gap-2 font-medium">
          {contact.name}
          {highlighted && (
            <span className="rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-medium text-white">
              Только что добавлен
            </span>
          )}
        </span>
        {details && <span className="truncate text-sm text-muted-foreground">{details}</span>}
      </Link>
    </li>
  );
}
