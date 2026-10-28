"use client";

import { Fragment, type ReactNode } from "react";
import { useRouter } from "next/navigation";

// Next.js keeps a page's state after the user leaves it (cacheComponents), so a form would show
// an abandoned draft on the next visit. This starts the children fresh on every link or redirect
// visit, while browser back/forward still restores them
export function ResetOnNavigation({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <Fragment key={bfcacheId}>{children}</Fragment>;
}
