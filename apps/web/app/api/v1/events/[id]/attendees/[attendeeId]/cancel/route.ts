import { cancelAttendees } from "@ot/core/services";
import { attendeeAction } from "../action";

export const runtime = "nodejs";

/** Cancel a confirmed or pending attendee: ticket revoked, seat returned, no email. */
export const POST = attendeeAction("cancelled", "confirmed or pending", cancelAttendees);
