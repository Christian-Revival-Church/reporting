"use client";

import { useMemo, useState } from "react";

import { UnlockReportButton } from "@/components/homecells/unlock-report-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MobileBottomSheet } from "@/components/ui/mobile-bottom-sheet";

type HomecellReportListItem = {
  id: string;
  weekStartDate: string;
  homecellName: string;
  membersPresent: number;
  totalMembers: number;
  attendanceRate: string;
  firstTimeVisitors: number;
  visitors: number;
  offeringLabel: string;
  submittedByName: string;
  isLocked: boolean;
};

type MobileHomecellReportsListProps = {
  reports: HomecellReportListItem[];
  canUnlock: boolean;
};

export function MobileHomecellReportsList({ reports, canUnlock }: MobileHomecellReportsListProps) {
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const activeReport = useMemo(
    () => reports.find((report) => report.id === activeReportId) ?? null,
    [activeReportId, reports],
  );

  return (
    <>
      <div className="space-y-2 md:hidden">
        {reports.map((report) => (
          <div key={report.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{report.homecellName}</p>
              <p className="text-xs text-slate-500">{report.weekStartDate}</p>
            </div>
            <Button type="button" variant="outline" className="h-8 px-3 text-xs" onClick={() => setActiveReportId(report.id)}>
              View more
            </Button>
          </div>
        ))}
      </div>

      <MobileBottomSheet
        open={Boolean(activeReport)}
        title={activeReport ? activeReport.homecellName : "Homecell Report"}
        onClose={() => setActiveReportId(null)}
      >
        {activeReport ? (
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Week:</span> {activeReport.weekStartDate}
            </p>
            <p>
              <span className="font-medium text-slate-900">Members:</span> {activeReport.membersPresent}/{activeReport.totalMembers}
            </p>
            <p>
              <span className="font-medium text-slate-900">Attendance:</span> {activeReport.attendanceRate}
            </p>
            <p>
              <span className="font-medium text-slate-900">Visitors:</span> {activeReport.firstTimeVisitors} first-time / {activeReport.visitors} total
            </p>
            <p>
              <span className="font-medium text-slate-900">Offering:</span> {activeReport.offeringLabel}
            </p>
            <p>
              <span className="font-medium text-slate-900">Submitted by:</span> {activeReport.submittedByName}
            </p>
            <div className="flex items-center justify-between">
              {activeReport.isLocked ? <Badge>Locked</Badge> : <Badge variant="success">Unlocked</Badge>}
              {canUnlock && activeReport.isLocked ? <UnlockReportButton reportId={activeReport.id} /> : null}
            </div>
          </div>
        ) : null}
      </MobileBottomSheet>
    </>
  );
}
