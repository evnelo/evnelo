/** Organization roles and what each may do. */
export type Role = "owner" | "admin" | "member" | "checkin";

export type Action =
  | "view_events"     // dashboard read access
  | "edit_events"     // create/edit/publish/cancel events, tickets, form
  | "manage_attendees" // approve/reject/export
  | "refund"          // money out
  | "manage_org"      // org profile, Stripe, keys
  | "manage_members"  // invite/remove/change roles
  | "check_in";       // scanner

const grants: Record<Role, Set<Action>> = {
  owner: new Set(["view_events", "edit_events", "manage_attendees", "refund", "manage_org", "manage_members", "check_in"]),
  admin: new Set(["view_events", "edit_events", "manage_attendees", "refund", "manage_org", "manage_members", "check_in"]),
  member: new Set(["view_events", "edit_events", "manage_attendees", "check_in"]),
  checkin: new Set(["check_in"]),
};

export function can(role: Role | null | undefined, action: Action): boolean {
  return !!role && grants[role].has(action);
}

export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", admin: "Admin", member: "Member", checkin: "Check-in staff" };
