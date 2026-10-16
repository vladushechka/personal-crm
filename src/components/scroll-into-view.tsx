"use client";

import { useEffect } from "react";

// Scrolls the element with the given id to the middle of the screen once
export function ScrollIntoView({ elementId }: { elementId: string }) {
  useEffect(() => {
    document.getElementById(elementId)?.scrollIntoView({ block: "center" });
  }, [elementId]);

  return null;
}
