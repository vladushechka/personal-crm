"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { SearchIcon } from "lucide-react";

import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";

const DEBOUNCE_MS = 250;

// Search box: puts the query into the URL (?q=...), the server filters the list
export function ContactSearch({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function search(query: string) {
    clearTimeout(timer.current);
    const trimmed = query.trim();
    const url = trimmed ? `/?q=${encodeURIComponent(trimmed)}` : "/";
    startTransition(() => router.replace(url, { scroll: false }));
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
      <InputGroup className="h-10 bg-background">
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
