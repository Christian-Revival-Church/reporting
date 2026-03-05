import { NotificationType, Role } from "@prisma/client";

import { resolveAttendanceScope } from "@/lib/attendance-scope";
import { db } from "@/lib/db";
import {
  REPORTING_DEADLINE_LABELS,
  ReportingDeadlineStage,
  getReportingDeadlineStage,
  getWeeklyReportingTimeline,
  mondayUtcForDate,
  reportingStageMessage,
  toDateKey,
} from "@/lib/reporting-deadlines";
import { hasPermission } from "@/lib/rbac";

type MissingHomecell = {
  id: string;
  name: string;
};

export type OutstandingReportsSummary = {
  dedupeKey: string;
  title: string;
  message: string;
  actionUrl: string;
  stage: Exclude<ReportingDeadlineStage, "NOT_DUE">;
  weekStartDate: string;
  weekEndDate: string;
  missingHomecells: MissingHomecell[];
};

type GetOutstandingInput = {
  churchId: string;
  userId: string;
  role: Role;
  now?: Date;
};

function summarizeMissingHomecells(items: MissingHomecell[]) {
  if (items.length === 0) return "No missing homecells.";
  if (items.length <= 3) return items.map((item) => item.name).join(", ");
  const preview = items.slice(0, 3).map((item) => item.name).join(", ");
  return `${preview}, +${items.length - 3} more`;
}

function stageTitle(stage: Exclude<ReportingDeadlineStage, "NOT_DUE">) {
  if (stage === "LOCKED") return "Weekly reporting locked";
  if (stage === "OUTSTANDING") return "Outstanding weekly reports";
  if (stage === "CHURCH_OVERDUE") return "Church reporting overdue";
  return "Homecell reporting overdue";
}

function stageWindowLabel() {
  return `Homecell ${REPORTING_DEADLINE_LABELS.homecellDue} | Church ${REPORTING_DEADLINE_LABELS.churchDue} | Outstanding ${REPORTING_DEADLINE_LABELS.outstandingDue} | Lock ${REPORTING_DEADLINE_LABELS.lockAt}`;
}

export async function getOutstandingReportsSummaryForUser(
  input: GetOutstandingInput,
): Promise<OutstandingReportsSummary | null> {
  if (!hasPermission(input.role, "homecell_reports:submit")) {
    return null;
  }

  const now = input.now ?? new Date();
  const currentWeekStart = mondayUtcForDate(now);
  const previousWeekStart = new Date(currentWeekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const previousTimeline = getWeeklyReportingTimeline(previousWeekStart);
  const targetWeekStart = now < previousTimeline.lockAt ? previousWeekStart : currentWeekStart;
  const timeline = getWeeklyReportingTimeline(targetWeekStart);
  const stage = getReportingDeadlineStage(now, timeline.weekStartDate);
  if (stage === "NOT_DUE") {
    return null;
  }

  const scope = await resolveAttendanceScope({
    churchId: input.churchId,
    userId: input.userId,
    role: input.role,
  });

  const scopedHomecellIds =
    input.role === Role.HOMECELL_LEADER
      ? undefined
      : scope.isFullAccess
        ? undefined
        : scope.homecellIds.length > 0
          ? scope.homecellIds
          : ["__no_scope__"];

  const homecells = await db.homecell.findMany({
    where: {
      churchId: input.churchId,
      ...(input.role === Role.HOMECELL_LEADER ? { leaderId: input.userId } : {}),
      ...(scopedHomecellIds ? { id: { in: scopedHomecellIds } } : {}),
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  if (homecells.length === 0) {
    return null;
  }

  const submittedReports = await db.homecellReport.findMany({
    where: {
      churchId: input.churchId,
      homecellId: { in: homecells.map((homecell) => homecell.id) },
      weekStartDate: timeline.weekStartDate,
    },
    select: { homecellId: true },
  });
  const submittedSet = new Set(submittedReports.map((report) => report.homecellId));
  const missingHomecells = homecells.filter((homecell) => !submittedSet.has(homecell.id));

  if (missingHomecells.length === 0) {
    return null;
  }

  const narrowedStage = stage as Exclude<ReportingDeadlineStage, "NOT_DUE">;
  const weekStartKey = toDateKey(timeline.weekStartDate);
  const weekEndKey = toDateKey(timeline.weekEndDate);
  const missingNames = summarizeMissingHomecells(missingHomecells);
  const title = stageTitle(narrowedStage);
  const actionUrl = `/dashboard/reporting?date=${weekEndKey}`;
  const message = `${missingHomecells.length} homecell report(s) missing for ${weekStartKey} to ${weekEndKey}: ${missingNames}. ${reportingStageMessage(narrowedStage)} ${stageWindowLabel()}`;
  const dedupeKey = `${weekStartKey}:${narrowedStage}:${missingHomecells
    .map((homecell) => homecell.id)
    .sort()
    .join(",")}`;

  return {
    dedupeKey,
    title,
    message,
    actionUrl,
    stage: narrowedStage,
    weekStartDate: weekStartKey,
    weekEndDate: weekEndKey,
    missingHomecells,
  };
}

export async function ensureOutstandingReportNotificationForUser(input: GetOutstandingInput): Promise<{
  created: number;
  summary: OutstandingReportsSummary | null;
}> {
  const summary = await getOutstandingReportsSummaryForUser(input);
  if (!summary) {
    return { created: 0, summary: null };
  }

  const weekStartDate = new Date(`${summary.weekStartDate}T00:00:00.000Z`);
  const existing = await db.notification.findFirst({
    where: {
      churchId: input.churchId,
      userId: input.userId,
      type: NotificationType.ALERT,
      title: summary.title,
      message: summary.message,
      actionUrl: summary.actionUrl,
      createdAt: { gte: weekStartDate },
    },
    select: { id: true },
  });

  if (existing) {
    return { created: 0, summary };
  }

  await db.notification.create({
    data: {
      churchId: input.churchId,
      userId: input.userId,
      type: NotificationType.ALERT,
      title: summary.title,
      message: summary.message,
      actionUrl: summary.actionUrl,
      scheduledFor: new Date(),
    },
  });

  return { created: 1, summary };
}
