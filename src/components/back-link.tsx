import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";

export function BackLink() {
  return (
    <Link href="/" className={buttonVariants({ variant: "ghost", className: "-ml-2.5" })}>
      <ArrowLeftIcon />
      Все контакты
    </Link>
  );
}
