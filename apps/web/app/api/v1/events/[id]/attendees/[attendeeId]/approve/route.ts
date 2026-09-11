import { approveAttendees } from "@evnelo/core/services";
import { attendeeAction } from "../action";

export const runtime = "nodejs";

/** Approve a pending registration: tickets are issued (or follow the payment on an unpaid order). */
export const POST = attendeeAction("approved", "pending", approveAttendees);
