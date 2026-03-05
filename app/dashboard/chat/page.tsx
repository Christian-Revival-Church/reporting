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
  const selectedThreadSummary = selectedThreadById ?? selectedThreadByPeer ?? null;
  const selectedPeer = selectedThreadSummary?.other ?? (params.peerId ? peers.find((peer) => peer.id === params.peerId) ?? null : null);

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
  const peerIdsWithThread = new Set(threads.map((thread) => thread.other.id));
  const peersWithoutThread = peers.filter((peer) => !peerIdsWithThread.has(peer.id));

  return (
    <div className="space-y-4">
      <ChatAutoRefresh enabled={Boolean(selectedThread)} />

      <section className="rounded-2xl border border-slate-900/10 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold sm:text-lg">Leadership Chat</h1>
            <p className="mt-1 text-sm text-slate-200">
              Secure church messaging between pastor and leadership structures.
            </p>
          </div>
          <span className="inline-flex shrink-0 rounded-full border border-white/30 bg-white/10 px-3 py-1 text-xs font-medium">
            {peers.length} contacts
          </span>
        </div>
        {errorMessage ? (
          <p className="mt-3 rounded-lg border border-red-200/70 bg-red-50 px-3 py-2 text-sm text-red-700">
            {errorMessage}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <Card className={cn("overflow-hidden p-0", hasOpenConversation ? "hidden lg:block" : "")}>
          <div className="border-b border-slate-200 px-4 py-4">
            <CardTitle>Conversations</CardTitle>
            <CardDescription className="mt-1">Open an existing chat or start a new one.</CardDescription>
          </div>

          <div className="max-h-[70vh] space-y-5 overflow-y-auto p-3">
            <section>
              <p className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Recent messages</p>
              <div className="mt-2 space-y-2">
                {threads.map((thread) => (
                  <Link
                    key={thread.id}
                    href={`/dashboard/chat?threadId=${thread.id}`}
                    className={cn(
                      "block rounded-xl border px-3 py-2.5",
                      selectedThreadSummary?.id === thread.id
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-medium">{thread.other.name}</p>
                      <span className="shrink-0 text-[11px] opacity-80">{formatConversationTime(thread.lastActivityAt)}</span>
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="truncate text-xs opacity-80">
                        {thread.lastMessage?.content ?? "No messages yet."}
                      </p>
                      {thread.isUnread ? (
                        <span className="inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500" />
                      ) : null}
                    </div>
                  </Link>
                ))}
                {threads.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    No chats yet. Start with a leadership contact below.
                  </p>
                ) : null}
              </div>
            </section>

            <section>
              <p className="px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase">Start new chat</p>
              <div className="mt-2 space-y-2">
                {peersWithoutThread.map((peer) => (
                  <Link
                    key={peer.id}
                    href={`/dashboard/chat?peerId=${peer.id}`}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5",
                      params.peerId === peer.id && !selectedThreadSummary
                        ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50",
                    )}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{peer.name}</p>
                      <p className="truncate text-xs opacity-80">{toStartCase(peer.role)}</p>
                    </div>
                    <Badge className="text-[10px]">New</Badge>
                  </Link>
                ))}
                {peers.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    No leadership contacts are available in this church yet.
                  </p>
                ) : null}
                {peers.length > 0 && peersWithoutThread.length === 0 ? (
                  <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                    Every available contact already has an open conversation.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        </Card>

        <Card className={cn("overflow-hidden p-0", hasOpenConversation ? "" : "hidden lg:block")}>
          {hasOpenConversation ? (
            <>
              <header className="border-b border-slate-200 bg-white/95 px-3 py-3 sm:px-4">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Link
                    href="/dashboard/chat"
                    className="inline-flex h-9 items-center gap-1 rounded-lg border border-slate-300 px-2 text-slate-700 hover:bg-slate-50 lg:hidden"
                    aria-label="Back to conversations"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    <span className="text-xs font-semibold">Chats</span>
                  </Link>
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-sm font-semibold text-slate-700">
                    {getInitials(activePeer?.name ?? "LC")}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-slate-900">{activePeer?.name ?? "Conversation"}</p>
                    <p className="truncate text-xs text-slate-500">
                      {activePeer ? `${toStartCase(activePeer.role)} | ${activePeer.email}` : "Direct leadership chat"}
                    </p>
                  </div>
                </div>
              </header>

              <div className="flex min-h-[420px] max-h-[72vh] flex-col bg-slate-50/70">
                <div className="flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
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

                <form action={sendChatMessageAction} className="border-t border-slate-200 bg-white p-3 sm:p-4">
                  {selectedThread ? <input type="hidden" name="threadId" value={selectedThread.id} /> : null}
                  {!selectedThread && activePeer ? <input type="hidden" name="recipientId" value={activePeer.id} /> : null}
                  <div className="flex items-end gap-2">
                    <textarea
                      name="content"
                      required
                      maxLength={2000}
                      placeholder="Type your message..."
                      className="min-h-12 flex-1 resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-100"
                    />
                    <button
                      type="submit"
                      className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={!selectedThread && !activePeer}
                      aria-label="Send message"
                    >
                      <Send className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              </div>
            </>
          ) : (
            <div className="flex min-h-[400px] flex-col items-center justify-center px-6 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-600">
                <MessageCircle className="h-5 w-5" />
              </span>
              <p className="mt-3 text-base font-semibold text-slate-900">Select a conversation</p>
              <p className="mt-1 max-w-md text-sm text-slate-500">
                Choose a leadership contact to start chatting.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
