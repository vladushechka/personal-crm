"use client";

import { useTransition } from "react";
import { Trash2Icon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { pluralize } from "@/lib/format";

// Deletes the contact only after the user confirms it in a dialog
export function DeleteContactButton({
  name,
  noteCount,
  action,
}: {
  name: string;
  noteCount: number;
  action: () => Promise<void>;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button variant="outline" />}>
        <Trash2Icon />
        Удалить
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить контакт «{name}»?</AlertDialogTitle>
          <AlertDialogDescription>
            {noteCount > 0 && (
              <>
                Будут удалены карточка и{" "}
                <span className="whitespace-nowrap">
                  {pluralize(noteCount, ["заметка", "заметки", "заметок"])}
                </span>
                .{" "}
              </>
            )}
            Отменить это нельзя.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={pending}
            onClick={() => startTransition(() => action())}
          >
            {pending && <Spinner />}
            Удалить
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
