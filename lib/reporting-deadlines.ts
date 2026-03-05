const REPORTING_TIMEZONE_OFFSET_MINUTES = 2 * 60; // Africa/Johannesburg (+02:00)
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type ReportingDeadlineStage =
  | "NOT_DUE"
  | "HOMECELL_OVERDUE"
  | "CHURCH_OVERDUE"
  | "OUTSTANDING"
  | "LOCKED";

export const REPORTING_DEADLINE_LABELS = {
  homecellDue: "Wednesday 20:30",
  churchDue: "Sunday 20:30",
  outstandingDue: "Monday 06:30",
  lockAt: "Monday 14:00",
} as const;

export function toDateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

export function mondayUtcForDate(value: Date) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  return date;
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * MS_PER_DAY);
}

function atReportingLocalTimeUtc(weekStartDate: Date, dayOffset: number, hour: number, minute: number) {
  const monday = mondayUtcForDate(weekStartDate);
  const utcTimestamp = Date.UTC(
    monday.getUTCFullYear(),
    monday.getUTCMonth(),
    monday.getUTCDate() + dayOffset,
    hour,
    minute,
    0,
    0,
  );

  return new Date(utcTimestamp - REPORTING_TIMEZONE_OFFSET_MINUTES * 60_000);
}

export function getWeeklyReportingTimeline(weekStartDate: Date) {
  const monday = mondayUtcForDate(weekStartDate);
  const weekEndDate = addUtcDays(monday, 6);
  const homecellDueAt = atReportingLocalTimeUtc(monday, 2, 20, 30); // Wed 20:30
  const churchDueAt = atReportingLocalTimeUtc(monday, 6, 20, 30); // Sun 20:30
  const outstandingDueAt = atReportingLocalTimeUtc(monday, 7, 6, 30); // Mon 06:30
  const lockAt = atReportingLocalTimeUtc(monday, 7, 14, 0); // Mon 14:00

  return {
    weekStartDate: monday,
    weekEndDate,
    homecellDueAt,
    churchDueAt,
    outstandingDueAt,
    lockAt,
  };
}

export function getReportingDeadlineStage(now: Date, weekStartDate: Date): ReportingDeadlineStage {
  const timeline = getWeeklyReportingTimeline(weekStartDate);

  if (now >= timeline.lockAt) return "LOCKED";
  if (now >= timeline.outstandingDueAt) return "OUTSTANDING";
  if (now >= timeline.churchDueAt) return "CHURCH_OVERDUE";
  if (now >= timeline.homecellDueAt) return "HOMECELL_OVERDUE";
  return "NOT_DUE";
}

export function isReportingWeekLocked(weekStartDate: Date, now = new Date()) {
  return now >= getWeeklyReportingTimeline(weekStartDate).lockAt;
}

export function reportingStageMessage(stage: ReportingDeadlineStage) {
  if (stage === "HOMECELL_OVERDUE") {
    return `Homecell reporting deadline passed (${REPORTING_DEADLINE_LABELS.homecellDue}).`;
  }
  if (stage === "CHURCH_OVERDUE") {
    return `Church reporting deadline passed (${REPORTING_DEADLINE_LABELS.churchDue}).`;
  }
  if (stage === "OUTSTANDING") {
    return `Outstanding window passed (${REPORTING_DEADLINE_LABELS.outstandingDue}).`;
  }
  if (stage === "LOCKED") {
    return `Weekly reporting is locked from ${REPORTING_DEADLINE_LABELS.lockAt}.`;
  }
  return "Reporting window is still within deadline.";
}
