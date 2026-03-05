import { Role } from "@prisma/client";

export const CHAT_ELIGIBLE_ROLES: Role[] = [
  Role.SUPER_ADMIN,
  Role.PASTOR,
  Role.OVERSEER,
  Role.SUPERVISOR,
  Role.COORDINATOR,
  Role.HOMECELL_LEADER,
  Role.CHURCH_ADMIN,
];

export function buildDirectChatKey(firstUserId: string, secondUserId: string) {
  return [firstUserId, secondUserId].sort().join(":");
}
