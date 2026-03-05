"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

type ChatAutoRefreshProps = {
  enabled: boolean;
  intervalMs?: number;
};

export function ChatAutoRefresh({ enabled, intervalMs = 5000 }: ChatAutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (!enabled) return undefined;
    const intervalId = window.setInterval(() => {
      router.refresh();
    }, intervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, intervalMs, router]);

  return null;
}
