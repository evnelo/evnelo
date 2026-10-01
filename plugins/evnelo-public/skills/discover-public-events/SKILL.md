---
name: discover-public-events
description: Find published public Evnelo events with live search and optionally display matching event cards. Use for public event discovery by city, dates, price or format.
---

# Discover public events

1. Respect explicit user instructions, especially text-only requests. Clarify material ambiguity about location or date timezone rather than guessing.
2. Use the host-exposed `search_public_events` tool; host namespace prefixes vary. Search only with supported arguments: query, city, tag, timezone-aware from/to, price (free/paid), format (online/in_person), lat/lng/radiusKm, limit and offset. Derive date boundaries from the user's intent and timezone. Use returned pagination.nextOffset for subsequent pages; do not invent pages.
3. Treat returned events as authoritative. Do not invent IDs, URLs, venues, dates, prices or availability. For visual browsing, call `render_event_cards` with `search` exactly matching the search filters and page, and `eventIds` containing at most 12 exact IDs selected from that returned page. Do not combine IDs across pages. For explicit text-only requests, summarize results without rendering cards.
4. When the user requests visual browsing and search returns no matches, still call `render_event_cards` with the same search and `eventIds: []` for the empty state. Explain no matches and offer to broaden the search without silently changing it.
5. Rendering re-fetches the public page. If a selected event becomes unavailable, search again; do not fabricate or repeatedly retry stale IDs. On tool failure explain discovery is unavailable and offer a later retry, not invented results.
6. Describe dates and prices as discovery metadata, not ticket inventory or purchase guarantees. Public event detail-page links are not specialized registration tools.

## Boundaries

Only published public events are supported. Do not retrieve private, unlisted or draft events, request organizer keys, create or publish events, access attendee or ticket credentials, purchase tickets, or perform checkout. Do not collect passwords or payment information. Explain unsupported requests plainly; do not claim an action occurred.
