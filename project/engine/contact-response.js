
/*
 * Experimental circle-to-pedestal contact response.
 *
 * Position correction + frictionless normal impulse.
 *
 * restitution = 0: no bounce
 * restitution = 1: ideal elastic bounce
 *
 * Coordinates: x right, y up.
 * Units: metres, seconds, kilograms.
 *
 * No angular impulse or friction yet.
 */

import {
    detectCirclePedestalContact
} from "./contact-geometry.js";

export function resolveCirclePedestalContact(
    body,
    pedestal,
    { restitution = 0 } = {}
) {
    if (
        !body ||
        !Number.isFinite(body.invMass) ||
        !Number.isFinite(body?.vel?.x) ||
        !Number.isFinite(body?.vel?.y) ||
        !Number.isFinite(restitution) ||
        restitution < 0 ||
        restitution > 1
    ) {
        throw new Error("Invalid contact response parameters.");
    }

    if (body.isStatic) {
        return null;
    }

    if (body?.geometry?.type !== "disk") {
        throw new Error(
            "Circle contact response requires disk geometry."
        );
    }

    const contact = detectCirclePedestalContact(
        body,
        pedestal
    );

    if (contact === null) {
        return null;
    }

    const { normal, penetration } = contact;

    // Move the circle out of the pedestal.
    body.pos.x += normal.x * penetration;
    body.pos.y += normal.y * penetration;

    const normalVelocityBefore =
        body.vel.x * normal.x +
        body.vel.y * normal.y;

    let normalImpulse = 0;

    // Apply an impulse only when moving into the surface.
    if (normalVelocityBefore < 0) {
        normalImpulse =
            -(1 + restitution) *
            normalVelocityBefore /
            body.invMass;

        body.vel.x +=
            normalImpulse * body.invMass * normal.x;

        body.vel.y +=
            normalImpulse * body.invMass * normal.y;
    }

    const normalVelocityAfter =
        body.vel.x * normal.x +
        body.vel.y * normal.y;

    return {
        pedestalId: contact.pedestalId,
        point: contact.point,
        normal,
        penetration,
        restitution,
        normalVelocityBefore,
        normalVelocityAfter,
        normalImpulse,
        correctedPosition: {
            x: body.pos.x,
            y: body.pos.y
        },
        velocityAfter: {
            x: body.vel.x,
            y: body.vel.y
        }
    };
}
