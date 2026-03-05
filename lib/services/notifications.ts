import { NotificationType, Role } from "@prisma/client";
import { addDays, startOfDay } from "date-fns";

import { db } from "@/lib/db";
import { ensureOutstandingReportNotificationForUser } from "@/lib/services/reporting-notifications";

export async function generateOperationalNotifications(churchId: string) {
  const today = startOfDay(new Date());
  const inThreeDays = addDays(today, 3);

  const users = await db.user.findMany({
    where: { churchId, isActive: true },
    select: { id: true, role: true },
  });

  const pendingVisitors = await db.visitor.count({
    where: {
      churchId,
      followUpStatus: "PENDING",
    },
  });

  const upcomingServices = await db.service.findMany({
    where: { churchId, eventDate: { gte: today, lte: inThreeDays } },
    select: { id: true, title: true, eventDate: true },
  });

  const notifications = users.flatMap((user) => {
    const created = [];

    if (pendingVisitors > 0 && user.role !== Role.HOMECELL_LEADER) {
      created.push({
        churchId,
        userId: user.id,
        type: NotificationType.ALERT,
        title: "Visitor follow-up pending",
        message: `${pendingVisitors} visitor(s) still require follow-up.`,
        actionUrl: "/dashboard/visitors",
      });
    }

    for (const service of upcomingServices) {
      created.push({
        churchId,
        userId: user.id,
        type: NotificationType.REMINDER,
        title: "Service attendance reminder",
        message: `Attendance marking for ${service.title} is due on ${service.eventDate.toDateString()}.`,
        actionUrl: `/dashboard/attendance?serviceId=${service.id}`,
      });
    }

    return created;
  });

  let created = 0;

  if (notifications.length) {
    await db.notification.createMany({
      data: notifications,
    });
    created += notifications.length;
  }

  const outstanding = await Promise.all(
    users.map((user) =>
      ensureOutstandingReportNotificationForUser({
        churchId,
        userId: user.id,
        role: user.role,
      }),
    ),
  );
  created += outstanding.reduce((total, item) => total + item.created, 0);

  return { created };
}

