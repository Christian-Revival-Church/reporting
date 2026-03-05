"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { toast } from "sonner";

type OutstandingPopupSummary = {
  dedupeKey: string;
  title: string;
  message: string;
  actionUrl: string;
  weekStartDate: string;
};

type OutstandingReportPopupProps = {
  summary: OutstandingPopupSummary | null;
};

const SESSION_STORAGE_KEY = "crc-reporting:outstanding-popup";

function isStandaloneDisplayMode() {
  const inStandaloneMode = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  const iosStandalone = Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return inStandaloneMode || iosStandalone;
}

async function showSystemNotification(summary: OutstandingPopupSummary) {
  if (typeof window === "undefined") return;
  if (!isStandaloneDisplayMode()) return;
  if (!("Notification" in window)) return;

  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }

  if (Notification.permission !== "granted") {
    return;
  }

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration?.showNotification) {
      await registration.showNotification(summary.title, {
        body: summary.message,
        icon: "/icons/icon-192.png",
        badge: "/icons/icon-192.png",
        tag: `crc-missing-reports-${summary.weekStartDate}`,
      });
      return;
    }
  }

  new Notification(summary.title, {
    body: summary.message,
    icon: "/icons/icon-192.png",
    tag: `crc-missing-reports-${summary.weekStartDate}`,
  });
}

export function OutstandingReportPopup({ summary }: OutstandingReportPopupProps) {
  const router = useRouter();

  useEffect(() => {
    if (!summary) {
      return;
    }

    const lastShown = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (lastShown === summary.dedupeKey) {
      return;
    }
    sessionStorage.setItem(SESSION_STORAGE_KEY, summary.dedupeKey);

    toast.error(summary.title, {
      description: summary.message,
      duration: 12000,
      action: {
        label: "Open",
        onClick: () => router.push(summary.actionUrl),
      },
    });

    void showSystemNotification(summary);
  }, [router, summary]);

  return null;
}
