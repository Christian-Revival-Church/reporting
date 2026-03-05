"use client";

import type { MembershipStatus } from "@prisma/client";
import Link from "next/link";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";

type MemberListItem = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  homecellName: string | null;
  departmentName: string | null;
  membershipStatus: MembershipStatus;
};

type MobileMembersListProps = {
  members: MemberListItem[];
};

function statusBadgeVariant(status: MembershipStatus) {
  if (status === "ACTIVE") return "success" as const;
  if (status === "INACTIVE") return "warning" as const;
  return "default" as const;
}

export function MobileMembersList({ members }: MobileMembersListProps) {
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const activeMember = members.find((member) => member.id === activeMemberId) ?? null;

  return (
    <>
      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3"
          >
            <p className="text-sm font-medium text-slate-900">
              {member.firstName} {member.lastName}
            </p>
            <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setActiveMemberId(member.id)}>
              View more
            </Button>
          </div>
        ))}
      </div>

      <MobileBottomSheet
        open={Boolean(activeMember)}
        title={activeMember ? `${activeMember.firstName} ${activeMember.lastName}` : "Member"}
        onClose={() => setActiveMemberId(null)}
      >
        {activeMember ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-slate-500">{activeMember.occupation ?? "No occupation set"}</p>
              <Badge variant={statusBadgeVariant(activeMember.membershipStatus)}>{activeMember.membershipStatus}</Badge>
            </div>
            <div className="space-y-2 text-sm text-slate-700">
              <p>
                <span className="font-medium text-slate-900">Phone:</span> {activeMember.phone ?? "-"}
              </p>
              <p>
                <span className="font-medium text-slate-900">Email:</span> {activeMember.email ?? "-"}
              </p>
              <p>
                <span className="font-medium text-slate-900">Homecell:</span> {activeMember.homecellName ?? "-"}
              </p>
              <p>
                <span className="font-medium text-slate-900">Department:</span> {activeMember.departmentName ?? "-"}
              </p>
            </div>
            <div className="flex items-center justify-end">
              <Link
                href={`/dashboard/members/${activeMember.id}`}
                className="inline-flex h-10 items-center justify-center rounded-lg bg-sky-700 px-4 text-sm font-medium text-white hover:bg-sky-800"
              >
                Open profile
              </Link>
            </div>
          </div>
        ) : null}
      </MobileBottomSheet>
    </>
  );
}
