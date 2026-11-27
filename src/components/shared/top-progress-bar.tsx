"use client";

import * as React from "react";
import { usePathname } from "next/navigation";

export function TopProgressBar() {
  const pathname = usePathname();
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    setActive(true);
    const t = setTimeout(() => setActive(false), 320);
    return () => clearTimeout(t);
  }, [pathname]);

  if (!active) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 h-0.5 bg-transparent pointer-events-none overflow-hidden"
      aria-hidden="true"
    >
      <div className="h-full bg-[#4CD7F6] animate-top-progress" />
    </div>
  );
}
