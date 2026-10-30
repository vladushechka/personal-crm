"use client";

import { useEffect } from "react";
import { TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-8">
      <Empty className="bg-card ring-1 ring-foreground/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlertIcon />
          </EmptyMedia>
          <EmptyTitle>Что-то пошло не так</EmptyTitle>
          <EmptyDescription>
            Не получилось загрузить или сохранить данные. Проверьте, что база данных запущена
            (команда <code>docker compose up -d</code>), и попробуйте ещё раз.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => retry()}>Попробовать ещё раз</Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
