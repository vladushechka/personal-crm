import Link from "next/link";
import { UserXIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";

export default function ContactNotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-6">
      <Empty className="bg-background ring-1 ring-foreground/10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <UserXIcon />
          </EmptyMedia>
          <EmptyTitle>Контакт не найден</EmptyTitle>
          <EmptyDescription>Возможно, в адресе страницы опечатка.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Link href="/" className={buttonVariants()}>
            Ко всем контактам
          </Link>
        </EmptyContent>
      </Empty>
    </main>
  );
}
