import Link from "next/link";
import { ChevronLeft, MessageCircle, Send } from "lucide-react";

import { sendChatMessageAction } from "@/app/dashboard/chat/actions";
import { ChatAutoRefresh } from "@/components/chat/chat-auto-refresh";
import { Badge } from "@/components/ui/badge";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { CHAT_ELIGIBLE_ROLES } from "@/lib/chat";
import { db } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { assertChurch, requireChurchContext } from "@/lib/tenant";
import { cn, getInitials, toStartCase } from "@/lib/utils";

type SearchParams = {
  threadId?: string;
  peerId?: string;
  error?: string;
};

const CHAT_ERRORS: Record<string, string> = {
  invalid_message: "Message could not be sent. Check that content is not empty.",
  thread_not_found: "Conversation was not found or no longer available.",
  recipient_not_found: "Recipient was not found or cannot receive chat messages.",
};

function formatConversationTime(value: Date) {
  const now = new Date();
  const sameDay =
    value.getFullYear() === now.getFullYear() &&
    value.getMonth() === now.getMonth() &&
    value.getDate() === now.getDate();
  if (sameDay) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(value);
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(value);
}

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const context = await requireChurchContext();
  const churchId = assertChurch(context.churchId);
  const params = await searchParams;

  if (!hasPermission(context.role, "chat:use")) {
    return (
      <Card>
        <CardTitle>Chat Access Restricted</CardTitle>
        <CardDescription className="mt-1">
          Your role does not include leadership chat access.
        </CardDescription>
      </Card>
    );
  }

  const [peers, threadRows] = await Promise.all([
    db.user.findMany({
      where: {
        churchId,
        isActive: true,
        role: { in: CHAT_ELIGIBLE_ROLES },
        id: { not: context.userId },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    db.chatThread.findMany({
      where: {
        churchId,
        participants: {
          some: { userId: context.userId },
        },
      },
      include: {
        participants: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
                role: true,
              },
            },
          },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            content: true,
            senderId: true,
            createdAt: true,
          },
        },
      },
      orderBy: [{ lastMessageAt: "desc" }, { updatedAt: "desc" }],
      take: 100,
    }),
  ]);

  const threads = threadRows
    .map((thread) => {
      const me = thread.participants.find((participant) => participant.userId === context.userId) ?? null;
      const other = thread.participants.find((participant) => participant.userId !== context.userId)?.user ?? null;
      const lastMessage = thread.messages[0] ?? null;
      const isUnread = Boolean(
        lastMessage &&
          lastMessage.senderId !== context.userId &&
          (!me?.lastReadAt || lastMessage.createdAt > me.lastReadAt),
      );

      if (!other) return null;

      return {
        id: thread.id,
        other,
        lastMessage,
        lastActivityAt: thread.lastMessageAt ?? lastMessage?.createdAt ?? thread.updatedAt,
        isUnread,
      };
    })
    .filter((thread): thread is NonNullable<typeof thread> => thread !== null)
    .sort(
      (first, second) =>
        second.lastActivityAt.getTime() - first.lastActivityAt.getTime() ||
        first.other.name.localeCompare(second.other.name),
    );

  const selectedThreadById = params.threadId ? threads.find((thread) => thread.id === params.threadId) ?? null : null;
  const selectedThreadByPeer = params.peerId
    ? threads.find((thread) => thread.other.id === params.peerId) ?? null
    : null;
  const selectedThreadSummary = selectedThreadById ?? selectedThreadByPeer ?? threads[0] ?? null;
  const selectedPeer = selectedThreadSummary
    ? selectedThreadSummary.other
    : params.peerId
      ? peers.find((peer) => peer.id === params.peerId) ?? null
      : null;

  const selectedThread = selectedThreadSummary
    ? await db.chatThread.findFirst({
        where: {
          id: selectedThreadSummary.id,
          churchId,
          participants: {
            some: { userId: context.userId },
          },
        },
        include: {
          participants: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  role: true,
                },
              },
            },
          },
          messages: {
            orderBy: { createdAt: "asc" },
            take: 300,
            include: {
              sender: {
                select: {
                  id: true,
                  name: true,
                  role: true,
                },
              },
            },
          },
        },
      })
    : null;

  if (selectedThread) {
    await db.chatParticipant.updateMany({
      where: {
        threadId: selectedThread.id,
        userId: context.userId,
      },
      data: {
        lastReadAt: new Date(),
      },
    });
  }

  const activePeer =
    selectedThread?.participants.find((participant) => participant.userId !== context.userId)?.user ?? selectedPeer;
  const hasOpenConversation = Boolean(selectedThread || activePeer);
  const errorMessage = params.error ? CHAT_ERRORS[params.error] ?? "Unable to complete chat action." : null;

  return (
    <div className="space-y-6">
      <ChatAutoRefresh enabled={Boolean(selectedThread)} />
      <Card>
        <CardTitle>Leadership Chat</CardTitle>
        <CardDescription className="mt-1">
          Secure church messaging between pastor and leadership structures.
        </CardDescription>
        <p className="mt-2 text-sm text-slate-600">
          Available contacts: <span className="font-medium">{peers.length}</span>
        </p>
        {errorMessage ? (
          <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Card className={cn(hasOpenConversation ? "hidden lg:block" : "")}>
          <CardTitle>Conversations</CardTitle>
          <CardDescription className="mt-1">Pick a leader contact to start or continue chatting.</CardDescription>

          <div className="mt-4">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Start New Chat</p>
            <div className="mt-2 space-y-2">
              {peers.map((peer) => {
                const hasThread = threads.some((thread) => thread.other.id === peer.id);
                return (
                  <Link
                    key={peer.id}
                    href={`/dashboard/chat?peerId=${peer.id}`}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
                      params.peerId === peer.id && !selectedThreadSummary
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{peer.name}</p>
                      <p className="truncate text-xs opacity-80">{toStartCase(peer.role)}</p>
                    </div>
                    {hasThread ? <Badge className="text-[10px]">Open</Badge> : <Badge className="text-[10px]">New</Badge>}
                  </Link>
                );
              })}
              {peers.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  No leadership contacts are available in this church yet.
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-5">
            <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Recent Messages</p>
            <div className="mt-2 space-y-2">
              {threads.map((thread) => (
                <Link
                  key={thread.id}
                  href={`/dashboard/chat?threadId=${thread.id}`}
                  className={cn(
                    "block rounded-xl border px-3 py-2",
                    selectedThreadSummary?.id === thread.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-medium">{thread.other.name}</p>
                    <span className="shrink-0 text-[11px] opacity-80">{formatConversationTime(thread.lastActivityAt)}</span>
                  </div>
                  <p className="mt-1 truncate text-xs opacity-80">
                    {thread.lastMessage?.content ?? "No messages yet."}
                  </p>
                  {thread.isUnread ? (
                    <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  ) : null}
                </Link>
              ))}
              {threads.length === 0 ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                  No chats yet. Start with a leader contact above.
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        <Card className={cn(hasOpenConversation ? "" : "hidden lg:block")}>
          {hasOpenConversation ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Link
                    href="/dashboard/chat"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-50 lg:hidden"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Link>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                    {getInitials(activePeer?.name ?? "LC")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{activePeer?.name ?? "Conversation"}</p>
                    <p className="truncate text-xs text-slate-500">
                      {activePeer ? `${toStartCase(activePeer.role)} - ${activePeer.email}` : "Direct leadership chat"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 max-h-[58vh] space-y-2 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                {selectedThread?.messages.map((message) => {
                  const mine = message.senderId === context.userId;
                  return (
                    <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[90%] rounded-2xl px-3 py-2 text-sm shadow-sm",
                          mine ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-800",
                        )}
                      >
                        {!mine ? (
                          <p className="mb-1 text-[11px] font-semibold text-slate-500">{message.sender.name}</p>
                        ) : null}
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                        <p className={cn("mt-1 text-[10px]", mine ? "text-slate-300" : "text-slate-500")}>
                          {formatConversationTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {selectedThread && selectedThread.messages.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">
                    Conversation started. Send the first message below.
                  </p>
                ) : null}
                {!selectedThread && activePeer ? (
                  <p className="rounded-xl border border-slate-200 bg-white p-3 text-sm text-slate-500">
                    Start your first message with {activePeer.name}.
                  </p>
                ) : null}
              </div>

              <form action={sendChatMessageAction} className="mt-4 flex items-end gap-2">
                {selectedThread ? <input type="hidden" name="threadId" value={selectedThread.id} /> : null}
                {!selectedThread && activePeer ? <input type="hidden" name="recipientId" value={activePeer.id} /> : null}
                <textarea
                  name="content"
                  required
                  maxLength={2000}
                  placeholder="Type your message..."
                  className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                />
                <button
                  type="submit"
                  className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!selectedThread && !activePeer}
                  aria-label="Send message"
                >
                  <Send className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="flex min-h-[380px] flex-col items-center justify-center text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="mt-3 text-base font-semibold text-slate-900">Select A Conversation</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Choose a leadership contact from the left to start chatting like WhatsApp.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
