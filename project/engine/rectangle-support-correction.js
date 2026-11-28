
/*
 * Phase 5E.4.6 — Experimental rectangular
 * pedestal penetration correction.
 *
 * Restores a penetrating rectangle to the
 * horizontal pedestal top by translating it
 * vertically by the deepest detected overlap.
 *
 * Does not change velocity or angular velocity.
 *
 * Limitations:
 * - Horizontal one-sided pedestal top only.
 * - Requires vertex contacts from the sampler.
 * - Does not handle edge-only contact.
 * - Does not solve friction, lateral collisions,
 *   rolling or multi-surface constraints.
 */

import {
    sampleRectanglePedestalContacts
} from "./rectangle-contact-geometry.js";

export function correctRectanglePedestalPenetration(
    body,
    pedestal,
    { slop = 0 } = {}
) {
    if (
        body?.geometry?.type !== "rectangle" ||
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.angle) ||
        !Number.isFinite(slop) ||
        slop < 0
    ) {
        throw new Error(
            "Invalid rectangular penetration correction."
        );
    }

    const contacts = sampleRectanglePedestalContacts(
        body,
        pedestal
    );

    const maximumPenetration = Math.max(
        0,
        ...contacts.map(c => c.penetration)
    );

    const correction = Math.max(
        0,
        maximumPenetration - slop
    );

    if (!body.isStatic && correction > 0) {
        body.pos.y += correction;
    }

    const remaining = sampleRectanglePedestalContacts(
        body,
        pedestal
    );

    return Object.freeze({
        maximumPenetration,
        correction: body.isStatic ? 0 : correction,

        originalContactCount: contacts.length,
        remainingContactCount: remaining.length,

        remainingMaximumPenetration: Math.max(
            0,
            ...remaining.map(c => c.penetration)
        )
    });
}
