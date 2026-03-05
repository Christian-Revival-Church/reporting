"use server";

import { AuditAction } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { logAudit } from "@/lib/audit";
import { buildDirectChatKey, CHAT_ELIGIBLE_ROLES } from "@/lib/chat";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";

const sendChatMessageSchema = z
  .object({
    threadId: z.string().cuid().optional(),
    recipientId: z.string().cuid().optional(),
    content: z.string().trim().min(1).max(2000),
  })
  .refine((value) => Boolean(value.threadId || value.recipientId), {
    message: "No conversation selected.",
  });

function buildChatHref(input: { threadId?: string; peerId?: string; error?: string }) {
  const params = new URLSearchParams();
  if (input.threadId) params.set("threadId", input.threadId);
  if (input.peerId) params.set("peerId", input.peerId);
  if (input.error) params.set("error", input.error);
  const query = params.toString();
  return query ? `/dashboard/chat?${query}` : "/dashboard/chat";
}

export async function sendChatMessageAction(formData: FormData) {
  const context = await requireChurchContext();
  if (!hasPermission(context.role, "chat:use")) {
    redirect("/dashboard");
  }

  const churchId = assertChurch(context.churchId);
  const threadIdRaw = String(formData.get("threadId") ?? "").trim();
  const recipientIdRaw = String(formData.get("recipientId") ?? "").trim();
  const contentRaw = String(formData.get("content") ?? "").trim();

  const parsed = sendChatMessageSchema.safeParse({
    threadId: threadIdRaw || undefined,
    recipientId: recipientIdRaw || undefined,
    content: contentRaw,
  });
  if (!parsed.success) {
    redirect(
      buildChatHref({
        threadId: threadIdRaw || undefined,
        peerId: recipientIdRaw || undefined,
        error: "invalid_message",
      }),
    );
  }

  let threadId: string | null = parsed.data.threadId ?? null;
  let peerId: string | null = parsed.data.recipientId ?? null;

  if (threadId) {
    const existingThread = await db.chatThread.findFirst({
      where: {
        id: threadId,
        churchId,
        participants: {
          some: { userId: context.userId },
        },
      },
      select: {
        id: true,
        participants: {
          select: {
            userId: true,
          },
        },
      },
    });
    if (!existingThread) {
      redirect(buildChatHref({ error: "thread_not_found" }));
    }
    threadId = existingThread.id;
    peerId = existingThread.participants.find((item) => item.userId !== context.userId)?.userId ?? null;
  } else {
    const recipient = await db.user.findFirst({
      where: {
        id: peerId ?? "",
        churchId,
        isActive: true,
        role: { in: CHAT_ELIGIBLE_ROLES },
      },
      select: {
        id: true,
      },
    });
    if (!recipient || recipient.id === context.userId) {
      redirect(buildChatHref({ error: "recipient_not_found" }));
    }

    const directKey = buildDirectChatKey(context.userId, recipient.id);
    const thread = await db.chatThread.upsert({
      where: {
        churchId_directKey: {
          churchId,
          directKey,
        },
      },
      update: {},
      create: {
        churchId,
        type: "DIRECT",
        directKey,
        createdById: context.userId,
        participants: {
          create: [
            { churchId, userId: context.userId },
            { churchId, userId: recipient.id },
          ],
        },
      },
      select: { id: true },
    });

    await db.chatParticipant.createMany({
      data: [
        { churchId, threadId: thread.id, userId: context.userId },
        { churchId, threadId: thread.id, userId: recipient.id },
      ],
      skipDuplicates: true,
    });

    threadId = thread.id;
    peerId = recipient.id;
  }

  if (!threadId) {
    redirect(buildChatHref({ error: "thread_not_found" }));
  }

  const message = await db.chatMessage.create({
    data: {
      churchId,
      threadId,
      senderId: context.userId,
      content: parsed.data.content,
    },
  });

  await db.chatThread.update({
    where: { id: threadId },
    data: {
      lastMessageAt: message.createdAt,
    },
  });

  await db.chatParticipant.updateMany({
    where: {
      threadId,
      userId: context.userId,
    },
    data: {
      lastReadAt: message.createdAt,
    },
  });

  await logAudit({
    churchId,
    actorUserId: context.userId,
    actorRole: context.role,
    action: AuditAction.CREATE,
    entity: "ChatMessage",
    entityId: message.id,
    payload: { threadId, peerId },
  });

  revalidatePath("/dashboard/chat");
  redirect(buildChatHref({ threadId }));
}
