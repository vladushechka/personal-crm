"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { SearchIcon } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

const DEBOUNCE_MS = 250;

// Search box: puts the query into the URL (?q=...), the server filters the list.
// A chosen group stays in the URL, so the search works inside it
export function ContactSearch({
  defaultValue,
  groupId,
}: {
  defaultValue: string;
  groupId?: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(query: string) {
    clearTimeout(timer.current);
    const params = new URLSearchParams();
    if (groupId) params.set("group", String(groupId));
    if (query.trim()) params.set("q", query.trim());
    const search = params.toString();
    startTransition(() => router.replace(search ? `/?${search}` : "/", { scroll: false }));
  }

  return (
    // Without JavaScript the form still works as a plain GET request
    <form
      action="/"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        search(new FormData(event.currentTarget).get("q")?.toString() ?? "");
      }}
    >
      {groupId && <input type="hidden" name="group" value={groupId} />}
      <InputGroup className="h-12 bg-card">
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
        <InputGroupInput
          type="search"
          name="q"
          defaultValue={defaultValue}
          placeholder="Найти по имени"
          aria-label="Поиск по имени"
          autoComplete="off"
          onChange={(event) => {
            const query = event.currentTarget.value;
            clearTimeout(timer.current);
            timer.current = setTimeout(() => search(query), DEBOUNCE_MS);
          }}
        />
        {isPending && (
          <InputGroupAddon align="inline-end">
            <Spinner />
          </InputGroupAddon>
        )}
      </InputGroup>
    </form>
  );
}
