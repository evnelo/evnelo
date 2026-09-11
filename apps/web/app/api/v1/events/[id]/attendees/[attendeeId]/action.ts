import type { Database } from "@ot/db";
import { getAttendeeView } from "@ot/core/services";
import { apiRoute, conflict, mutate, notFound, requireOrgEvent } from "@/lib/api";
import { serializeAttendee } from "@/lib/api-serializers";
import { db } from "@/lib/db";

/**
 * approve / reject / cancel share one shape: the attendee must exist in the event (404), the
 * service only touches rows in an eligible status (0 rows → 409 explaining the current status),
 * and the updated attendee comes back.
 */
export function attendeeAction(verb: string, eligible: string, service: (database: Database, eventId: string, ids: string[]) => Promise<number>) {
  return apiRoute<{ id: string; attendeeId: string }>("write", async ({ request, auth, params }) => {
    await requireOrgEvent(auth, params.id);
    const before = await getAttendeeView(db, params.id, params.attendeeId);
    if (!before) throw notFound("Attendee");
    return mutate(request, auth, null, async (database) => {
      const changed = await service(database, params.id, [params.attendeeId]);
      if (changed === 0) throw conflict(`Attendee is ${before.attendee.status}; only ${eligible} registrations can be ${verb}.`);
      return { body: { data: serializeAttendee((await getAttendeeView(database, params.id, params.attendeeId))!) } };
    });
  });
}
