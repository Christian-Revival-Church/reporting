"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import { cn } from "@/lib/utils";

export function SignOutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-300 bg-white text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50",
        "sm:w-auto sm:gap-2 sm:px-3",
      )}
    >
      <LogOut className="h-4 w-4" />
      <span className="hidden sm:inline">Sign out</span>
    </button>
  );
}
