"use client";

import type { FollowUpStatus } from "@prisma/client";
import { useMemo, useState } from "react";

import { FollowupSelect } from "@/components/visitors/followup-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";

type VisitorListItem = {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string;
  invitedBy: string | null;
  firstTime: boolean;
  convertedToMember: boolean;
  followUpStatus: FollowUpStatus;
};

type MobileVisitorsListProps = {
  visitors: VisitorListItem[];
  canManage: boolean;
};

export function MobileVisitorsList({ visitors, canManage }: MobileVisitorsListProps) {
  const [activeVisitorId, setActiveVisitorId] = useState<string | null>(null);
  const activeVisitor = useMemo(
    () => visitors.find((visitor) => visitor.id === activeVisitorId) ?? null,
    [activeVisitorId, visitors],
  );

  return (
    <>
      <div className="space-y-2 md:hidden">
        {visitors.map((visitor) => (
          <div key={visitor.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-sm font-medium text-slate-900">
              {visitor.firstName} {visitor.lastName ?? ""}
            </p>
            <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setActiveVisitorId(visitor.id)}>
              View more
            </Button>
          </div>
        ))}
      </div>

      <MobileBottomSheet
        open={Boolean(activeVisitor)}
        title={activeVisitor ? `${activeVisitor.firstName} ${activeVisitor.lastName ?? ""}` : "Visitor"}
        onClose={() => setActiveVisitorId(null)}
      >
        {activeVisitor ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Phone:</span> {activeVisitor.phone}
            </p>
            <p>
              <span className="font-medium text-slate-900">Invited by:</span> {activeVisitor.invitedBy ?? "-"}
            </p>
            <div className="flex flex-wrap gap-2">
              {activeVisitor.firstTime ? <Badge variant="success">First-time</Badge> : <Badge>Returning</Badge>}
              {activeVisitor.convertedToMember ? <Badge variant="success">Converted</Badge> : <Badge variant="warning">Not yet</Badge>}
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-900">Follow-up</p>
              {canManage ? (
                <FollowupSelect visitorId={activeVisitor.id} value={activeVisitor.followUpStatus} />
              ) : (
                <Badge>{activeVisitor.followUpStatus}</Badge>
              )}
            </div>
          </div>
        ) : null}
      </MobileBottomSheet>
    </>
  );
}
