"use client";

import * as React from "react";
import { Activity } from "lucide-react";

export function SplashScreen() {
  const [visible, setVisible] = React.useState(false);
  const [fading, setFading] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (sessionStorage.getItem("pulse_splash_seen")) return;

    sessionStorage.setItem("pulse_splash_seen", "1");
    setVisible(true);

    const fadeTimer = setTimeout(() => setFading(true), 700);
    const hideTimer = setTimeout(() => setVisible(false), 1000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(hideTimer);
    };
  }, []);

  if (!visible) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0E1416] transition-opacity duration-300 pointer-events-none ${
        fading ? "opacity-0" : "opacity-100"
      }`}
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#4CD7F6] text-[#003640] animate-pulse-heartbeat">
          <Activity className="h-8 w-8" />
        </div>
        <span className="text-lg font-bold tracking-tight text-[#E6ECEE]">
          Pulse
        </span>
      </div>
    </div>
  );
}
