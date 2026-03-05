import type { Role } from "@prisma/client";
import {
  BarChart3,
  LayoutDashboard,
  Settings,
  Users,
  WavesLadder,
} from "lucide-react";

import { hasPermission } from "@/lib/rbac";

export const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "notifications:view" as const },
  { href: "/dashboard/reporting", label: "Reporting", icon: BarChart3, permission: "attendance:view" as const },
  { href: "/dashboard/summary", label: "Summary", icon: WavesLadder, permission: "homecell_reports:view" as const },
  { href: "/dashboard/membership", label: "Membership", icon: Users, permission: "members:view" as const },
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
    permission: "church:create" as const,
  },
];

export function getNavItemsForRole(role: Role) {
  return navItems.filter((item) => hasPermission(role, item.permission));
}

function normalizePathname(pathname: string) {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

export function isNavItemActive(pathname: string, href: string) {
  const current = normalizePathname(pathname);
  const target = normalizePathname(href);

  if (target === "/dashboard") {
    return current === target;
  }

  return current === target || current.startsWith(`${target}/`);
}
