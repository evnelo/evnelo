// Generated from apps/web/lib/openapi.ts by `pnpm --filter @evnelo/sdk generate`. Do not edit by hand.

export interface paths {
    "/public/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Search published public events */
        get: operations["searchPublicEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/organization": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the API key's organization */
        get: operations["getOrganization"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update the organization
         * @description Partial update: absent keys keep their value. An empty string clears `website`, `logoUrl` or `accentColor`. The slug must be unused and not reserved.
         */
        patch: operations["updateOrganization"];
        trace?: never;
    };
    "/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List events belonging to the API key organization */
        get: operations["listEvents"];
        put?: never;
        /** Create a draft event */
        post: operations["createEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an event and its ticket types, tags, hosts, sponsors, and registration fields */
        get: operations["getEvent"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /**
         * Update an event
         * @description Partial update. The patch is merged over the stored event, including `tags`, `hosts` and `sponsors` (send the full array to change them), and validated as a whole. On a published event a new time or place queues the "event updated" notifications.
         */
        patch: operations["updateEvent"];
        trace?: never;
    };
    "/events/{id}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Publish a draft event
         * @description A free "General admission" ticket type is created when the event has none, so registration works immediately. Public events become discoverable. No request body.
         */
        post: operations["publishEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel an event
         * @description Attendees are told by email (and SMS where opted in). Paid orders are refunded separately through the orders endpoints. Cancelling twice is a no-op. No request body.
         */
        post: operations["cancelEvent"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/stats": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Registrations, revenue and check-ins for an event */
        get: operations["getEventStats"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/ticket-types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List ticket types */
        get: operations["listTicketTypes"];
        put?: never;
        /** Create a ticket type */
        post: operations["createTicketType"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/ticket-types/{ticketTypeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a ticket type */
        delete: operations["deleteTicketType"];
        options?: never;
        head?: never;
        /**
         * Update a ticket type
         * @description Partial update merged over the stored ticket type. `quantity` can't drop below the seats already sold or held (422).
         */
        patch: operations["updateTicketType"];
        trace?: never;
    };
    "/events/{id}/fields": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the registration form fields */
        get: operations["listRegistrationFields"];
        /**
         * Replace the registration form
         * @description The whole form, in order. Include each existing field's `id` to keep collected answers attached; fields without an id are created and fields not listed are deleted. A field may only depend (`condition`) on fields before it in the same `scope`; select fields need options. Same input as the dashboard form builder.
         */
        put: operations["replaceRegistrationFields"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List orders */
        get: operations["listOrders"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/orders/{orderId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an order with its items and attendees */
        get: operations["getOrder"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/orders/{orderId}/refund": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Refund an order in full
         * @description Requests a full refund from Stripe, the same path as the dashboard. The order moves to `refunded` (party cancelled, tickets revoked, seats returned) when Stripe confirms through its webhook, so poll the order or subscribe to `order.refunded`. No request body.
         */
        post: operations["refundOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/attendees": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List attendees */
        get: operations["listAttendees"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/attendees/export.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /**
         * Export every attendee as CSV
         * @description All statuses, one row per person (guests included), with custom answers as columns. Same file as the dashboard export.
         */
        get: operations["exportAttendeesCsv"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/attendees/{attendeeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an attendee */
        get: operations["getAttendee"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/attendees/{attendeeId}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Approve a pending registration
         * @description Tickets are issued right away for free and paid orders; on an order still awaiting payment they follow the payment. No request body.
         */
        post: operations["approveAttendee"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/attendees/{attendeeId}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Reject a pending registration
         * @description The seat is returned and a rejection email queued. Paid orders are refunded separately. No request body.
         */
        post: operations["rejectAttendee"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/attendees/{attendeeId}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Cancel a confirmed or pending attendee
         * @description The ticket is revoked and the seat returned. No email is sent. No request body.
         */
        post: operations["cancelAttendee"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/check-ins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List active check-ins */
        get: operations["listCheckIns"];
        put?: never;
        /**
         * Check a ticket in
         * @description By ticket id or by the QR `token` (raw token or the full ticket URL). Recorded with method `manual`. Never fails for a bad ticket: `outcome` says what happened, and `already` returns the earlier check-in time. Concurrent scans of one ticket yield one check-in.
         */
        post: operations["checkIn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/check-ins/{ticketId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Undo the active check-in for a ticket
         * @description 404 when the ticket has no active check-in. The audit row is kept with `undoneAt` set.
         */
        delete: operations["undoCheckIn"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/discount-codes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List discount codes */
        get: operations["listDiscountCodes"];
        put?: never;
        /** Create a discount code */
        post: operations["createDiscountCode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/discount-codes/{codeId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete a discount code */
        delete: operations["deleteDiscountCode"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/waitlist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List waitlist entries */
        get: operations["listWaitlist"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/waitlist/{entryId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /**
         * Remove a waitlist entry
         * @description An open offer gives its held seat back.
         */
        delete: operations["deleteWaitlistEntry"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/waitlist/{entryId}/promote": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Offer a seat to a waitlist entry
         * @description Holds one seat on the ticket type for 24 hours (counted against capacity) and mints the claim link. Unlike the dashboard, the API does not email the person: send them `offerUrl`. A lapsed offer releases the seat and the entry can be promoted again.
         */
        post: operations["promoteWaitlistEntry"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/invites": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List invite links */
        get: operations["listInvites"];
        put?: never;
        /**
         * Create an invite link
         * @description Optionally bound to one email (the registrant must use that address) with a use budget and expiry. The API does not send the invitation: share `url`. Members of the organization never need an invite.
         */
        post: operations["createInvite"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/events/{id}/invites/{inviteId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Revoke an invite link */
        delete: operations["deleteInvite"];
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List webhook subscriptions */
        get: operations["listWebhooks"];
        put?: never;
        /**
         * Subscribe an endpoint to events
         * @description The signing `secret` is returned in this response only. Deliveries carry `evnelo-signature` (hex HMAC-SHA256 of `{timestamp}.{body}`), `evnelo-timestamp` (unix seconds) and `evnelo-delivery-id`, and are retried with backoff.
         */
        post: operations["createWebhook"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a webhook */
        get: operations["getWebhook"];
        put?: never;
        post?: never;
        /** Delete a webhook */
        delete: operations["deleteWebhook"];
        options?: never;
        head?: never;
        /**
         * Update a webhook
         * @description Change the URL or subscribed events, or pause and resume with `active`.
         */
        patch: operations["updateWebhook"];
        trace?: never;
    };
    "/webhooks/{id}/rotate-secret": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /**
         * Rotate the signing secret
         * @description The previous secret stops verifying immediately; the new one is returned once. No request body.
         */
        post: operations["rotateWebhookSecret"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhooks/{id}/deliveries": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List recent deliveries of a webhook */
        get: operations["listWebhookDeliveries"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/webhook-events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the event types a webhook can subscribe to */
        get: operations["listWebhookEvents"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/openapi.json": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** This document */
        get: operations["getOpenApiDocument"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/docs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Interactive API reference (HTML) */
        get: operations["getApiDocs"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        Error: {
            /** @enum {string} */
            code: "unauthorized" | "forbidden" | "not_found" | "conflict" | "validation_error" | "invalid_json" | "payload_too_large" | "unsupported_media_type" | "idempotency_conflict" | "idempotency_in_progress" | "rate_limit_exceeded" | "internal_error";
            message: string;
            /** @description zod issues on validation failures. */
            issues?: {
                path?: (string | number)[];
                message?: string;
                code?: string;
            }[];
        };
        ErrorResponse: {
            error: components["schemas"]["Error"];
        };
        Pagination: {
            limit: number;
            offset: number;
            /** @description Offset of the next page, or null on the last page. */
            nextOffset: number | null;
        };
        DeletedResponse: {
            data: {
                id: string;
                /** @constant */
                deleted: true;
            };
        };
        SocialLink: {
            /** @enum {string} */
            platform: "website" | "x" | "linkedin" | "instagram" | "youtube" | "discord" | "bluesky" | "threads" | "tiktok" | "mastodon" | "other";
            /** Format: uri */
            url: string;
        };
        Host: {
            name: string;
            title?: string | null;
            /** @description Must use http:// or https://. An empty string is normalized to null. */
            avatarUrl?: string | "" | null;
            /** @default [] */
            socialLinks?: components["schemas"]["SocialLink"][];
        };
        Sponsor: {
            name: string;
            /** @description Must use http:// or https://. An empty string is normalized to null. */
            logoUrl?: string | "" | null;
            tier?: string | null;
            /** @description Must use http:// or https://. An empty string is normalized to null. */
            website?: string | "" | null;
            /** @default [] */
            socialLinks?: components["schemas"]["SocialLink"][];
        };
        /**
         * @example {
         *       "id": "01J9Z6M5Y3K3F1Q2R8S9T0V1W3",
         *       "slug": "demo",
         *       "name": "Demo Collective",
         *       "logoUrl": null,
         *       "website": "https://demo.example.com",
         *       "accentColor": "#1f7a4d",
         *       "socialLinks": [],
         *       "stripeChargesEnabled": false,
         *       "feePassThrough": false,
         *       "createdAt": "2026-08-01T00:00:00.000Z",
         *       "updatedAt": "2026-08-01T00:00:00.000Z"
         *     }
         */
        Organization: {
            id: string;
            slug: string;
            name: string;
            logoUrl: string | null;
            website: string | null;
            /** @description #rrggbb */
            accentColor: string | null;
            socialLinks: components["schemas"]["SocialLink"][];
            /** @description Whether the organization can take paid orders. */
            stripeChargesEnabled: boolean;
            /** @description Default for new events: buyers pay the service fee. */
            feePassThrough: boolean;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @description Unknown properties are ignored. */
        UpdateOrganizationInput: {
            name?: string;
            /** @description Reserved words (api, dashboard, …) are refused. */
            slug?: string;
            /** @description http(s) URL; a bare domain is normalized; empty string clears. */
            website?: string;
            /** @description URL; empty string clears. */
            logoUrl?: string;
            /** @description Empty string clears. */
            accentColor?: string;
            socialLinks?: {
                platform: string;
                /** Format: uri */
                url: string;
            }[];
            feePassThrough?: boolean;
        };
        PublicEvent: {
            id: string;
            slug: string;
            name: string;
            descriptionMd?: string | null;
            /** Format: uri */
            coverImageUrl?: string | null;
            /** Format: date-time */
            startsAt: string;
            /** Format: date-time */
            endsAt: string;
            timezone: string;
            city?: string | null;
            country?: string | null;
            locationType: string;
            venueName?: string | null;
            organizationId: string;
            orgName: string;
            orgSlug: string;
            /** @description True when every visible ticket type costs nothing. */
            isFree: boolean;
            /** @description Cheapest visible ticket price in minor units, null when the event has no visible ticket type. */
            minPriceMinor?: number | null;
            /** @description ISO currency of minPriceMinor. */
            currency?: string | null;
            /** @description Great-circle distance from the lat/lng origin, null when none was given. */
            distanceKm?: number | null;
        };
        /**
         * @example {
         *       "id": "01J9Z6M5Y3K3F1Q2R8S9T0V1W2",
         *       "organizationId": "01J9Z6M5Y3K3F1Q2R8S9T0V1W3",
         *       "slug": "design-systems-meetup",
         *       "name": "Design Systems Meetup",
         *       "descriptionMd": "Talks and demos.",
         *       "coverImageUrl": null,
         *       "timezone": "Europe/Lisbon",
         *       "startsAt": "2026-10-02T18:00:00.000Z",
         *       "endsAt": "2026-10-02T21:00:00.000Z",
         *       "locationType": "in_person",
         *       "venueName": "The Loft",
         *       "address": "Rua Augusta 1",
         *       "city": "Lisbon",
         *       "country": "PT",
         *       "lat": null,
         *       "lng": null,
         *       "onlineUrl": null,
         *       "visibility": "public",
         *       "status": "published",
         *       "requiresApproval": false,
         *       "capacity": 120,
         *       "waitlistEnabled": true,
         *       "collectPhone": false,
         *       "guestsEnabled": true,
         *       "maxGuests": 1,
         *       "feePassThrough": false,
         *       "refundPolicy": null,
         *       "socialLinks": [],
         *       "reminderHours": [
         *         24,
         *         1
         *       ],
         *       "publishedAt": "2026-09-01T09:00:00.000Z",
         *       "deletedAt": null,
         *       "createdAt": "2026-08-30T10:00:00.000Z",
         *       "updatedAt": "2026-09-01T09:00:00.000Z"
         *     }
         */
        Event: {
            id: string;
            organizationId: string;
            /** @description Unique within the organization; the public page is /{orgSlug}/{slug}. */
            slug: string;
            name: string;
            descriptionMd?: string | null;
            coverImageUrl?: string | null;
            timezone: string;
            /** Format: date-time */
            startsAt: string;
            /** Format: date-time */
            endsAt: string;
            /** @enum {string} */
            locationType: "in_person" | "online" | "hybrid";
            venueName?: string | null;
            address?: string | null;
            city?: string | null;
            country?: string | null;
            lat?: string | null;
            lng?: string | null;
            onlineUrl?: string | null;
            /** @enum {string} */
            visibility: "public" | "unlisted" | "private";
            /** @enum {string} */
            status: "draft" | "published" | "cancelled" | "ended";
            requiresApproval: boolean;
            capacity?: number | null;
            waitlistEnabled?: boolean;
            collectPhone?: boolean;
            guestsEnabled: boolean;
            maxGuests: number;
            feePassThrough?: boolean;
            refundPolicy?: string | null;
            socialLinks?: components["schemas"]["SocialLink"][];
            reminderHours?: number[];
            /** Format: date-time */
            publishedAt?: string | null;
            /** Format: date-time */
            deletedAt?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @description Unknown properties are ignored. `country` is upper-cased before validation. */
        CreateEventInput: {
            name: string;
            slug?: string;
            descriptionMd?: string | null;
            /** @description Must use http:// or https://. An empty string is normalized to null. */
            coverImageUrl?: string | "" | null;
            /** @description IANA time zone used for display. */
            timezone: string;
            /** Format: date-time */
            startsAt: string;
            /** Format: date-time */
            endsAt: string;
            /**
             * @default in_person
             * @enum {string}
             */
            locationType?: "in_person" | "online" | "hybrid";
            venueName?: string | null;
            address?: string | null;
            city?: string | null;
            country?: string | null;
            lat?: string | null;
            lng?: string | null;
            /** @description Must use http:// or https://. An empty string is normalized to null. */
            onlineUrl?: string | "" | null;
            /**
             * @default public
             * @enum {string}
             */
            visibility?: "public" | "unlisted" | "private";
            /** @default false */
            requiresApproval?: boolean;
            capacity?: number | null;
            /** @default false */
            waitlistEnabled?: boolean;
            /** @default false */
            collectPhone?: boolean;
            /** @default false */
            guestsEnabled?: boolean;
            /** @default 1 */
            maxGuests?: number;
            /** @default false */
            feePassThrough?: boolean;
            refundPolicy?: string | null;
            /** @default [] */
            socialLinks?: components["schemas"]["SocialLink"][];
            /**
             * @default [
             *       24,
             *       1
             *     ]
             */
            reminderHours?: number[];
            /** @default [] */
            tags?: string[];
            /** @default [] */
            hosts?: components["schemas"]["Host"][];
            /** @default [] */
            sponsors?: components["schemas"]["Sponsor"][];
        };
        /** @description Any subset of the event's fields. Arrays (`tags`, `hosts`, `sponsors`, `socialLinks`, `reminderHours`) replace the stored list. */
        UpdateEventInput: {
            name?: string;
            slug?: string;
            descriptionMd?: string | null;
            /** @description Must use http:// or https://. An empty string is normalized to null. */
            coverImageUrl?: string | "" | null;
            /** @description IANA time zone used for display. */
            timezone?: string;
            /** Format: date-time */
            startsAt?: string;
            /** Format: date-time */
            endsAt?: string;
            /**
             * @default in_person
             * @enum {string}
             */
            locationType?: "in_person" | "online" | "hybrid";
            venueName?: string | null;
            address?: string | null;
            city?: string | null;
            country?: string | null;
            lat?: string | null;
            lng?: string | null;
            /** @description Must use http:// or https://. An empty string is normalized to null. */
            onlineUrl?: string | "" | null;
            /**
             * @default public
             * @enum {string}
             */
            visibility?: "public" | "unlisted" | "private";
            /** @default false */
            requiresApproval?: boolean;
            capacity?: number | null;
            /** @default false */
            waitlistEnabled?: boolean;
            /** @default false */
            collectPhone?: boolean;
            /** @default false */
            guestsEnabled?: boolean;
            /** @default 1 */
            maxGuests?: number;
            /** @default false */
            feePassThrough?: boolean;
            refundPolicy?: string | null;
            /** @default [] */
            socialLinks?: components["schemas"]["SocialLink"][];
            /**
             * @default [
             *       24,
             *       1
             *     ]
             */
            reminderHours?: number[];
            /** @default [] */
            tags?: string[];
            /** @default [] */
            hosts?: components["schemas"]["Host"][];
            /** @default [] */
            sponsors?: components["schemas"]["Sponsor"][];
        };
        EventListItem: {
            event: components["schemas"]["Event"];
            /** @description Confirmed attendees. */
            registrations: number;
            /** @description Attendees awaiting approval. */
            pending: number;
            /** @description Paid minus refunded. Integer minor units (cents); see `currency`. */
            revenue: number;
            checkedIn: number;
        };
        EventListResponse: {
            data: components["schemas"]["EventListItem"][];
            pagination: components["schemas"]["Pagination"];
        };
        EventResponse: {
            data: components["schemas"]["Event"];
        };
        EventDetailsResponse: {
            data: {
                event: components["schemas"]["Event"];
                ticketTypes: components["schemas"]["TicketType"][];
                hosts: components["schemas"]["Host"][];
                sponsors: components["schemas"]["Sponsor"][];
                tags: {
                    name: string;
                    slug: string;
                }[];
                registrationFields: components["schemas"]["RegistrationField"][];
            };
        };
        EventStats: {
            registrations: number;
            pending: number;
            /** @description Paid minus refunded. Integer minor units (cents); see `currency`. */
            revenue: number;
            checkedIn: number;
            currency: string;
            byTicketType: {
                id: string;
                name: string;
                priceMinor: number;
                currency: string;
                sold: number;
                held: number;
                quantity: number | null;
            }[];
            /** @description Live registrations per calendar day (UTC). */
            byDay: {
                /** Format: date */
                day: string;
                count: number;
            }[];
        };
        /**
         * @example {
         *       "id": "01J9Z6M5Y3K3F1Q2R8S9T0V1W4",
         *       "eventId": "01J9Z6M5Y3K3F1Q2R8S9T0V1W2",
         *       "name": "Early bird",
         *       "description": null,
         *       "priceMinor": 2500,
         *       "currency": "EUR",
         *       "quantity": 50,
         *       "sold": 12,
         *       "held": 1,
         *       "minPerOrder": 1,
         *       "maxPerOrder": 4,
         *       "salesStartAt": null,
         *       "salesEndAt": "2026-09-25T00:00:00.000Z",
         *       "hidden": false,
         *       "accessCode": null,
         *       "taxRateBps": 2300,
         *       "position": 0,
         *       "createdAt": "2026-08-30T10:00:00.000Z",
         *       "updatedAt": "2026-08-30T10:00:00.000Z"
         *     }
         */
        TicketType: {
            id: string;
            eventId: string;
            name: string;
            description?: string | null;
            /** @description Price per ticket. Integer minor units (cents); see `currency`. */
            priceMinor: number;
            currency: string;
            /** @description null = unlimited. */
            quantity?: number | null;
            sold: number;
            /** @description Seats in pending checkouts and open waitlist offers. */
            held: number;
            minPerOrder: number;
            maxPerOrder: number;
            /** Format: date-time */
            salesStartAt?: string | null;
            /** Format: date-time */
            salesEndAt?: string | null;
            hidden: boolean;
            accessCode?: string | null;
            taxRateBps: number;
            position: number;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        /** @description Unknown properties are ignored. */
        TicketTypeInput: {
            name: string;
            description?: string | null;
            /** @description Price per ticket. Integer minor units (cents); see `currency`. */
            priceMinor: number;
            /**
             * @description ISO 4217, upper-cased.
             * @default USD
             */
            currency?: string;
            /** @description null = unlimited. */
            quantity?: number | null;
            /** @default 1 */
            minPerOrder?: number;
            /** @default 10 */
            maxPerOrder?: number;
            /** Format: date-time */
            salesStartAt?: string | null;
            /** Format: date-time */
            salesEndAt?: string | null;
            /** @default false */
            hidden?: boolean;
            accessCode?: string | null;
            /**
             * @description Tax rate in basis points (2300 = 23%).
             * @default 0
             */
            taxRateBps?: number;
        };
        /** @description Any subset of the ticket type's fields. */
        UpdateTicketTypeInput: {
            name?: string;
            description?: string | null;
            /** @description Price per ticket. Integer minor units (cents); see `currency`. */
            priceMinor?: number;
            /**
             * @description ISO 4217, upper-cased.
             * @default USD
             */
            currency?: string;
            /** @description null = unlimited. */
            quantity?: number | null;
            /** @default 1 */
            minPerOrder?: number;
            /** @default 10 */
            maxPerOrder?: number;
            /** Format: date-time */
            salesStartAt?: string | null;
            /** Format: date-time */
            salesEndAt?: string | null;
            /** @default false */
            hidden?: boolean;
            accessCode?: string | null;
            /**
             * @description Tax rate in basis points (2300 = 23%).
             * @default 0
             */
            taxRateBps?: number;
        };
        ConditionRule: {
            /** @description Key of an earlier field in the same scope. */
            fieldKey: string;
            /** @enum {string} */
            op: "eq" | "neq" | "contains" | "empty" | "not_empty";
            value?: string;
        };
        ConditionGroup: {
            /** @enum {string} */
            op: "and" | "or";
            rules: components["schemas"]["ConditionRule"][];
        };
        FieldOption: {
            value: string;
            label: string;
        };
        RegistrationField: {
            id: string;
            eventId: string;
            key: string;
            label: string;
            helpText?: string | null;
            placeholder?: string | null;
            /** @enum {string} */
            type: "short_text" | "long_text" | "email" | "phone" | "number" | "select" | "multi_select" | "checkbox" | "date" | "url" | "file" | "consent";
            options?: components["schemas"]["FieldOption"][] | null;
            required: boolean;
            /** @enum {string} */
            scope: "order" | "attendee" | "guest";
            /** @description null = shown for every ticket type. */
            ticketTypeIds?: string[] | null;
            condition?: components["schemas"]["ConditionGroup"] | null;
            position: number;
        };
        RegistrationFieldInput: {
            /** @description Existing field id to update in place; omit to create. */
            id?: string;
            /** @description Answer key; unique within the form. */
            key: string;
            label: string;
            helpText?: string | null;
            placeholder?: string | null;
            /** @enum {string} */
            type: "short_text" | "long_text" | "email" | "phone" | "number" | "select" | "multi_select" | "checkbox" | "date" | "url" | "file" | "consent";
            /** @description Required for select and multi_select. */
            options?: components["schemas"]["FieldOption"][] | null;
            /** @default false */
            required?: boolean;
            /**
             * @default attendee
             * @enum {string}
             */
            scope?: "order" | "attendee" | "guest";
            ticketTypeIds?: string[] | null;
            condition?: components["schemas"]["ConditionGroup"] | null;
        };
        /**
         * @example {
         *       "id": "01J9Z6M5Y3K3F1Q2R8S9T0V1W6",
         *       "eventId": "01J9Z6M5Y3K3F1Q2R8S9T0V1W2",
         *       "organizationId": "01J9Z6M5Y3K3F1Q2R8S9T0V1W3",
         *       "userId": null,
         *       "email": "ana@example.com",
         *       "status": "paid",
         *       "currency": "EUR",
         *       "subtotalMinor": 2500,
         *       "discountMinor": 0,
         *       "taxMinor": 575,
         *       "serviceFeeMinor": 0,
         *       "totalMinor": 3075,
         *       "platformFeeMinor": 0,
         *       "refundedMinor": 0,
         *       "discountCodeId": null,
         *       "stripePaymentIntentId": "pi_3Q0example",
         *       "stripeAccountId": null,
         *       "holdExpiresAt": null,
         *       "paidAt": "2026-09-02T12:00:30.000Z",
         *       "answers": {
         *         "code_of_conduct": true
         *       },
         *       "createdAt": "2026-09-02T12:00:00.000Z",
         *       "updatedAt": "2026-09-02T12:00:30.000Z"
         *     }
         */
        Order: {
            id: string;
            eventId: string;
            organizationId: string;
            userId?: string | null;
            email: string;
            /** @enum {string} */
            status: "pending" | "processing" | "paid" | "free" | "refunded" | "partially_refunded" | "failed" | "expired";
            currency: string;
            /** @description Ticket prices before discount. Integer minor units (cents); see `currency`. */
            subtotalMinor: number;
            /** @description Discount applied. Integer minor units (cents); see `currency`. */
            discountMinor: number;
            /** @description Tax. Integer minor units (cents); see `currency`. */
            taxMinor: number;
            /** @description Service fee shown to the buyer when passed through. Integer minor units (cents); see `currency`. */
            serviceFeeMinor: number;
            /** @description Amount charged. Integer minor units (cents); see `currency`. */
            totalMinor: number;
            /** @description Platform fee (Cloud edition). Integer minor units (cents); see `currency`. */
            platformFeeMinor: number;
            /** @description Refunded so far. Integer minor units (cents); see `currency`. */
            refundedMinor: number;
            discountCodeId?: string | null;
            stripePaymentIntentId?: string | null;
            /** @description Connected account the payment lives on (Cloud). */
            stripeAccountId?: string | null;
            /**
             * Format: date-time
             * @description Seat hold deadline while pending.
             */
            holdExpiresAt?: string | null;
            /** Format: date-time */
            paidAt?: string | null;
            /** @description Answers to order-scope registration fields. */
            answers: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
        };
        OrderListItem: components["schemas"]["Order"] & {
            attendeeCount: number;
            /** @description Name of the first non-guest attendee. */
            buyerName: string | null;
        };
        OrderItem: {
            id: string;
            ticketTypeId: string;
            ticketTypeName: string;
            quantity: number;
            /** @description Unit price at purchase. Integer minor units (cents); see `currency`. */
            unitPriceMinor: number;
        };
        OrderDetails: components["schemas"]["Order"] & {
            items: components["schemas"]["OrderItem"][];
            attendees: components["schemas"]["Attendee"][];
        };
        RefundRequested: {
            orderId: string;
            /** @description Order status at the time of the request. */
            status: string;
            /** @constant */
            refund: "requested";
        };
        AttendeeTicket: {
            id: string;
            /** @description The QR payload; also accepted by the check-in endpoint. */
            token: string;
            /**
             * Format: uri
             * @description Ticket page.
             */
            url: string;
            /** Format: date-time */
            revokedAt: string | null;
            /**
             * Format: date-time
             * @description Active check-in time, null when not checked in.
             */
            checkedInAt: string | null;
        };
        /**
         * @example {
         *       "id": "01J9Z6M5Y3K3F1Q2R8S9T0V1W5",
         *       "eventId": "01J9Z6M5Y3K3F1Q2R8S9T0V1W2",
         *       "orderId": "01J9Z6M5Y3K3F1Q2R8S9T0V1W6",
         *       "ticketTypeId": "01J9Z6M5Y3K3F1Q2R8S9T0V1W4",
         *       "userId": null,
         *       "guestOfAttendeeId": null,
         *       "name": "Ana Silva",
         *       "email": "ana@example.com",
         *       "phone": null,
         *       "smsOptIn": false,
         *       "remindersOptOut": false,
         *       "status": "confirmed",
         *       "answers": {
         *         "role": "designer"
         *       },
         *       "deletedAt": null,
         *       "createdAt": "2026-09-02T12:00:00.000Z",
         *       "updatedAt": "2026-09-02T12:00:00.000Z",
         *       "ticketTypeName": "Early bird",
         *       "hostName": null,
         *       "order": {
         *         "id": "01J9Z6M5Y3K3F1Q2R8S9T0V1W6",
         *         "status": "paid",
         *         "totalMinor": 3075,
         *         "currency": "EUR"
         *       },
         *       "ticket": {
         *         "id": "01J9Z6M5Y3K3F1Q2R8S9T0V1W7",
         *         "token": "k3Jx9Qv2Lm8Np4Rt6Wy1Zb5Cd7Ef0Gh",
         *         "url": "https://tickets.example.com/t/k3Jx9Qv2Lm8Np4Rt6Wy1Zb5Cd7Ef0Gh",
         *         "revokedAt": null,
         *         "checkedInAt": null
         *       }
         *     }
         */
        Attendee: {
            id: string;
            eventId: string;
            orderId: string;
            ticketTypeId: string;
            userId?: string | null;
            /** @description Set on +1 guests; null on the person who registered. */
            guestOfAttendeeId: string | null;
            name: string;
            email: string;
            /** @description E.164. */
            phone?: string | null;
            smsOptIn?: boolean;
            remindersOptOut?: boolean;
            /** @enum {string} */
            status: "pending_approval" | "confirmed" | "rejected" | "cancelled" | "waitlisted";
            /** @description Answers to attendee-scope (or guest-scope) registration fields. */
            answers: {
                [key: string]: unknown;
            };
            /** Format: date-time */
            deletedAt?: string | null;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            ticketTypeName: string;
            /** @description For guests: the host's name. */
            hostName: string | null;
            order: {
                id: string;
                status: string;
                /** @description Order total. Integer minor units (cents); see `currency`. */
                totalMinor: number;
                currency: string;
            };
            /** @description null until a ticket is issued (pending approval or unpaid order). */
            ticket: components["schemas"]["AttendeeTicket"] | null;
        };
        /** @description One of ticketId or token. */
        CheckInInput: {
            /** @description 26-character ULID. */
            ticketId?: string;
            /** @description QR payload: the raw token or the ticket URL. */
            token?: string;
        };
        CheckInAttendee: {
            ticketId: string;
            attendeeId: string;
            name: string;
            email: string;
            ticketTypeName: string;
            hostName: string | null;
            /** Format: date-time */
            checkedInAt: string | null;
        };
        CheckInResult: {
            /**
             * @description ok = checked in now; already = was checked in (see checkedInAt); the rest refuse entry.
             * @enum {string}
             */
            outcome: "ok" | "already" | "not_found" | "revoked" | "not_confirmed" | "wrong_event";
            attendee: components["schemas"]["CheckInAttendee"] | null;
            /** Format: date-time */
            checkedInAt: string | null;
        };
        CheckIn: {
            id: string;
            ticketId: string;
            attendeeId: string;
            name: string;
            email: string;
            ticketTypeName: string;
            /** @enum {string} */
            method: "scan" | "manual";
            /** Format: date-time */
            checkedInAt: string;
        };
        DiscountCode: {
            id: string;
            eventId: string;
            code: string;
            /** @enum {string} */
            kind: "percent" | "fixed";
            /** @description Percent (1–100) or minor units for fixed. */
            value: number;
            maxUses: number | null;
            uses: number;
            /** Format: date-time */
            expiresAt: string | null;
            /** Format: date-time */
            createdAt: string;
        };
        DiscountCodeInput: {
            /** @description Upper-cased on save. */
            code: string;
            /** @enum {string} */
            kind: "percent" | "fixed";
            /** @description Percent (max 100) or minor units. */
            value: number;
            maxUses?: number | null;
            /** Format: date-time */
            expiresAt?: string | null;
        };
        WaitlistEntry: {
            id: string;
            eventId: string;
            /** @description Set once promoted: the seat being held. */
            ticketTypeId: string | null;
            email: string;
            name: string | null;
            /** Format: date-time */
            promotedAt: string | null;
            /** Format: date-time */
            holdExpiresAt: string | null;
            /** Format: date-time */
            expiredAt: string | null;
            /** Format: date-time */
            registeredAt: string | null;
            orderId: string | null;
            /** Format: date-time */
            createdAt: string;
            ticketTypeName: string | null;
            /** @enum {string} */
            status: "waiting" | "offered" | "registered" | "expired";
        };
        PromoteWaitlistInput: {
            /** @description 26-character ULID. */
            ticketTypeId: string;
        };
        WaitlistOffer: components["schemas"]["WaitlistEntry"] & {
            /**
             * Format: uri
             * @description Claim link, valid until holdExpiresAt.
             */
            offerUrl: string;
        };
        Invite: {
            id: string;
            eventId: string;
            /** @description When set, only this address can register with the link. */
            email: string | null;
            token: string;
            maxUses: number;
            uses: number;
            /** Format: date-time */
            expiresAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /**
             * Format: uri
             * @description The /i/{token} link to share.
             */
            url: string;
            /** @enum {string} */
            status: "valid" | "expired" | "exhausted";
        };
        InviteInput: {
            /**
             * Format: email
             * @description Bind the link to one address; empty or absent = shareable.
             */
            email?: string;
            /** @default 1 */
            maxUses?: number;
            expiresInDays?: number | null;
        };
        /** @enum {string} */
        WebhookEventType: "registration.created" | "order.paid" | "order.refunded" | "attendee.checked_in" | "event.published" | "event.updated" | "event.cancelled";
        /**
         * @example {
         *       "id": "01J9Z6M5Y3K3F1Q2R8S9T0V1W8",
         *       "organizationId": "01J9Z6M5Y3K3F1Q2R8S9T0V1W3",
         *       "url": "https://hooks.example.com/evnelo",
         *       "events": [
         *         "order.paid",
         *         "attendee.checked_in"
         *       ],
         *       "active": true,
         *       "createdAt": "2026-09-01T09:00:00.000Z"
         *     }
         */
        Webhook: {
            id: string;
            organizationId: string;
            /** Format: uri */
            url: string;
            events: components["schemas"]["WebhookEventType"][];
            active: boolean;
            /** Format: date-time */
            createdAt: string;
        };
        WebhookWithSecret: components["schemas"]["Webhook"] & {
            /** @description HMAC key, shown once. Store it. */
            secret: string;
        };
        WebhookSecret: {
            id: string;
            secret: string;
        };
        WebhookInput: {
            /**
             * Format: uri
             * @description https:// (http://localhost allowed for development).
             */
            url: string;
            events: components["schemas"]["WebhookEventType"][];
            /** @default true */
            active?: boolean;
        };
        UpdateWebhookInput: {
            /** Format: uri */
            url?: string;
            events?: components["schemas"]["WebhookEventType"][];
            active?: boolean;
        };
        WebhookDelivery: {
            id: string;
            webhookId: string;
            event: components["schemas"]["WebhookEventType"];
            /** @description The envelope that was (or will be) POSTed. */
            payload: {
                id: string;
                type: components["schemas"]["WebhookEventType"];
                /** Format: date-time */
                createdAt: string;
                organizationId: string;
                data: unknown;
            };
            attempts: number;
            /** Format: date-time */
            nextAttemptAt: string | null;
            responseStatus: number | null;
            /** Format: date-time */
            deliveredAt: string | null;
            /** Format: date-time */
            createdAt: string;
            /** @enum {string} */
            state: "pending" | "retrying" | "delivered" | "failed";
        };
        PublicEventListResponse: {
            data: components["schemas"]["PublicEvent"][];
            pagination: components["schemas"]["Pagination"];
        };
    };
    responses: {
        /** @description Missing, revoked, or invalid API key */
        Unauthorized: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description API key lacks the required scope */
        Forbidden: {
            headers: {
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description The request body is not valid JSON */
        BadRequest: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Resource not found in the API key organization */
        NotFound: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Request validation failed */
        ValidationError: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description The idempotency key is in progress or was used for a different request */
        IdempotencyConflict: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description The request body exceeds 256 KiB */
        PayloadTooLarge: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Content-Type must be application/json */
        UnsupportedMediaType: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Request limit exceeded */
        RateLimited: {
            headers: {
                "Retry-After"?: number;
                "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
        /** @description Unexpected server error */
        InternalError: {
            headers: {
                "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                [name: string]: unknown;
            };
            content: {
                "application/json": components["schemas"]["ErrorResponse"];
            };
        };
    };
    parameters: never;
    requestBodies: never;
    headers: {
        /** @description Maximum requests allowed in the current one-minute window. */
        RateLimitLimit: number;
        /** @description Requests remaining in the current window. */
        RateLimitRemaining: number;
        /** @description Unix time (seconds) when the current window resets. */
        RateLimitReset: number;
    };
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    searchPublicEvents: {
        parameters: {
            query?: {
                query?: string;
                city?: string;
                tag?: string;
                /** @description Only events still running at or after this instant. */
                from?: string;
                /** @description Only events starting at or before this instant. */
                to?: string;
                /** @description "free" matches events where every visible ticket type costs nothing. */
                price?: "free" | "paid";
                /** @description Hybrid events match both values. */
                format?: "online" | "in_person";
                /** @description Latitude of the search origin. Must be sent with lng. */
                lat?: number;
                /** @description Longitude of the search origin. Must be sent with lat. */
                lng?: number;
                /** @description Search radius in kilometres, applied only when lat and lng are given. */
                radiusKm?: number;
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Matching events */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["PublicEventListResponse"];
                };
            };
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getOrganization: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Organization */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Organization"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateOrganization: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateOrganizationInput"];
            };
        };
        responses: {
            /** @description Updated organization */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Organization"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description The slug is already taken. Also: the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listEvents: {
        parameters: {
            query?: {
                status?: "draft" | "published" | "cancelled" | "ended";
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Organization events, latest start first, with registration, pending, revenue and check-in counts */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventListResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createEvent: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateEventInput"];
            };
        };
        responses: {
            /** @description Event created */
            201: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getEvent: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event details */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventDetailsResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateEvent: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateEventInput"];
            };
        };
        responses: {
            /** @description Updated event */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventResponse"];
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    publishEvent: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Published event */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description A cancelled event can't be published again. Also: the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    cancelEvent: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cancelled event */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EventResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getEventStats: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event statistics */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["EventStats"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listTicketTypes: {
        parameters: {
            query?: {
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Ticket types in display order */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["TicketType"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createTicketType: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["TicketTypeInput"];
            };
        };
        responses: {
            /** @description Ticket type created (appended last) */
            201: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["TicketType"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    deleteTicketType: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
                /** @description Ticket type id */
                ticketTypeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeletedResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The ticket type has sales or holds; hide it instead. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateTicketType: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
                /** @description Ticket type id */
                ticketTypeId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateTicketTypeInput"];
            };
        };
        responses: {
            /** @description Updated ticket type */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["TicketType"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listRegistrationFields: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Fields in form order */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["RegistrationField"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    replaceRegistrationFields: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegistrationFieldInput"][];
            };
        };
        responses: {
            /** @description The saved form */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["RegistrationField"][];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listOrders: {
        parameters: {
            query?: {
                status?: "pending" | "processing" | "paid" | "free" | "refunded" | "partially_refunded" | "failed" | "expired";
                /** @description Exact buyer email (case-insensitive). */
                email?: string;
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Orders, newest first */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["OrderListItem"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getOrder: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
                /** @description Order id */
                orderId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Order details */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["OrderDetails"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    refundOrder: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
                /** @description Order id */
                orderId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Refund requested */
            202: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["RefundRequested"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The order has no payment, or is not in a refundable status. Also: the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listAttendees: {
        parameters: {
            query?: {
                /** @description Matches name, email or phone. */
                q?: string;
                status?: "pending_approval" | "confirmed" | "rejected" | "cancelled" | "waitlisted";
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attendees, newest first, with ticket link and check-in state */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Attendee"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    exportAttendeesCsv: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description CSV file */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description attachment; filename="{slug}-attendees.csv" */
                    "Content-Disposition"?: string;
                    [name: string]: unknown;
                };
                content: {
                    "text/csv": string;
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getAttendee: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
                /** @description Attendee id */
                attendeeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Attendee */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Attendee"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    approveAttendee: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
                /** @description Attendee id */
                attendeeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Approved attendee */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Attendee"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The attendee is not pending approval. Also: the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    rejectAttendee: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
                /** @description Attendee id */
                attendeeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Rejected attendee */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Attendee"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The attendee is not pending approval. Also: the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    cancelAttendee: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
                /** @description Attendee id */
                attendeeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Cancelled attendee */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Attendee"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The attendee is neither confirmed nor pending. Also: the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listCheckIns: {
        parameters: {
            query?: {
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Check-ins, newest first (undone ones excluded) */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["CheckIn"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    checkIn: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CheckInInput"];
            };
        };
        responses: {
            /** @description Check-in outcome */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["CheckInResult"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    undoCheckIn: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
                /** @description Ticket id */
                ticketId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeletedResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listDiscountCodes: {
        parameters: {
            query?: {
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Codes, newest first */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["DiscountCode"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createDiscountCode: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DiscountCodeInput"];
            };
        };
        responses: {
            /** @description Code created */
            201: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["DiscountCode"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The code already exists for this event. Also: the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    deleteDiscountCode: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
                /** @description Discount code id */
                codeId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeletedResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listWaitlist: {
        parameters: {
            query?: {
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Entries, oldest first, with their derived status */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["WaitlistEntry"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    deleteWaitlistEntry: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
                /** @description Waitlist entry id */
                entryId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeletedResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    promoteWaitlistEntry: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
                /** @description Waitlist entry id */
                entryId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["PromoteWaitlistInput"];
            };
        };
        responses: {
            /** @description Seat held and claim link minted */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["WaitlistOffer"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description The person already has an open offer or already registered, or no seat is free. Also: the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listInvites: {
        parameters: {
            query?: {
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Invites, newest first, with their link and derived status */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Invite"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createInvite: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Event id */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InviteInput"];
            };
        };
        responses: {
            /** @description Invite created */
            201: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Invite"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    deleteInvite: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Event id */
                id: string;
                /** @description Invite id */
                inviteId: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeletedResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listWebhooks: {
        parameters: {
            query?: {
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Webhooks, newest first (secrets never included) */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Webhook"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    createWebhook: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WebhookInput"];
            };
        };
        responses: {
            /** @description Webhook created, with its secret */
            201: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["WebhookWithSecret"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Webhook id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Webhook */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Webhook"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    deleteWebhook: {
        parameters: {
            query?: never;
            header?: never;
            path: {
                /** @description Webhook id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deleted */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["DeletedResponse"];
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    updateWebhook: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Webhook id */
                id: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["UpdateWebhookInput"];
            };
        };
        responses: {
            /** @description Updated webhook */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["Webhook"];
                    };
                };
            };
            400: components["responses"]["BadRequest"];
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            413: components["responses"]["PayloadTooLarge"];
            415: components["responses"]["UnsupportedMediaType"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    rotateWebhookSecret: {
        parameters: {
            query?: never;
            header?: {
                /** @description Optional key retained for 24 hours per API key. A repeat with the same key and body replays the original response (`Idempotency-Replayed: true`); a different body is a 409. */
                "Idempotency-Key"?: string;
            };
            path: {
                /** @description Webhook id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description New secret */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    /** @description Present when the original response was replayed. */
                    "Idempotency-Replayed"?: "true";
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["WebhookSecret"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            /** @description the idempotency key is in progress or was used for a different request. */
            409: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ErrorResponse"];
                };
            };
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listWebhookDeliveries: {
        parameters: {
            query?: {
                limit?: number;
                /** @description Use `pagination.nextOffset` from the previous page. */
                offset?: number;
            };
            header?: never;
            path: {
                /** @description Webhook id */
                id: string;
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Deliveries, newest first, with attempts, last response status and state */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["WebhookDelivery"][];
                        pagination: components["schemas"]["Pagination"];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            404: components["responses"]["NotFound"];
            422: components["responses"]["ValidationError"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    listWebhookEvents: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Event types */
            200: {
                headers: {
                    "X-RateLimit-Limit": components["headers"]["RateLimitLimit"];
                    "X-RateLimit-Remaining": components["headers"]["RateLimitRemaining"];
                    "X-RateLimit-Reset": components["headers"]["RateLimitReset"];
                    [name: string]: unknown;
                };
                content: {
                    "application/json": {
                        data: components["schemas"]["WebhookEventType"][];
                    };
                };
            };
            401: components["responses"]["Unauthorized"];
            403: components["responses"]["Forbidden"];
            429: components["responses"]["RateLimited"];
            500: components["responses"]["InternalError"];
        };
    };
    getOpenApiDocument: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description OpenAPI 3.1 document */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": Record<string, never>;
                };
            };
        };
    };
    getApiDocs: {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            /** @description Scalar API reference */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "text/html": string;
                };
            };
        };
    };
}
