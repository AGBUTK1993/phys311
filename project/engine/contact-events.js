
/*
 * Phase 5E.2 — Distinct contact-event detection.
 *
 * Tracks one body/surface contact pair.
 * Emits an impact only when contact begins
 * with sufficient inward normal speed.
 *
 * This experimental module does not apply forces,
 * modify bodies, or change gameplay.
 *
 * separation > 0: gap between surfaces
 * separation = 0: touching
 * separation < 0: penetration
 * normalSpeed < 0: approaching the surface
 *
 * Units: metres, seconds, m/s.
 */

export function createContactEventTracker({
    bodyId,
    surfaceId,
    entryTolerance = 1e-8,
    releaseDistance = 0.01,
    minimumImpactSpeed = 0.1
}) {
    if (
        typeof bodyId !== "string" ||
        !bodyId.trim() ||
        typeof surfaceId !== "string" ||
        !surfaceId.trim() ||
        !Number.isFinite(entryTolerance) ||
        !Number.isFinite(releaseDistance) ||
        !Number.isFinite(minimumImpactSpeed) ||
        entryTolerance < 0 ||
        releaseDistance <= entryTolerance ||
        minimumImpactSpeed < 0
    ) {
        throw new Error("Invalid contact-event configuration.");
    }

    return {
        bodyId,
        surfaceId,
        entryTolerance,
        releaseDistance,
        minimumImpactSpeed,
        inContact: false,
        nextEventNumber: 1,
        lastTime: -Infinity,
        events: []
    };
}

export function updateContactEventTracker(
    tracker,
    { time, separation, normalSpeed }
) {
    if (
        !tracker ||
        !Array.isArray(tracker.events) ||
        !Number.isSafeInteger(tracker.nextEventNumber) ||
        !Number.isFinite(time) ||
        time < 0 ||
        !Number.isFinite(separation) ||
        !Number.isFinite(normalSpeed) ||
        time < tracker.lastTime
    ) {
        throw new Error("Invalid contact-event update.");
    }

    tracker.lastTime = time;

    // Contact hysteresis prevents tiny numerical
    // gaps from producing repeated impact events.
    if (tracker.inContact) {
        if (separation >= tracker.releaseDistance) {
            tracker.inContact = false;

            return {
                state: "separated",
                event: null
            };
        }

        return {
            state: "persistent-contact",
            event: null
        };
    }

    // No contact has begun.
    if (separation > tracker.entryTolerance) {
        return {
            state: "separated",
            event: null
        };
    }

    tracker.inContact = true;

    // Gentle contact is not a significant impact.
    if (normalSpeed >= -tracker.minimumImpactSpeed) {
        return {
            state: "gentle-contact",
            event: null
        };
    }

    const event = Object.freeze({
        eventId:
            `${tracker.bodyId}:${tracker.surfaceId}:` +
            tracker.nextEventNumber,

        bodyId: tracker.bodyId,
        surfaceId: tracker.surfaceId,
        time,
        incomingNormalSpeed: -normalSpeed
    });

    tracker.nextEventNumber++;
    tracker.events.push(event);

    return {
        state: "new-impact",
        event
    };
}

export function getContactEventSummary(tracker) {
    if (
        !tracker ||
        !Array.isArray(tracker.events)
    ) {
        throw new Error("Invalid contact-event tracker.");
    }

    return Object.freeze({
        bodyId: tracker.bodyId,
        surfaceId: tracker.surfaceId,
        inContact: tracker.inContact,
        impactCount: tracker.events.length,
        events: Object.freeze([...tracker.events])
    });
}
