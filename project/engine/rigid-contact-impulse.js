
/*
 * Phase 5E.4.4a — Rotational contact impulse.
 *
 * Resolves a frictionless normal impact between
 * a dynamic rectangular body and a fixed surface.
 *
 * The caller supplies:
 * - World-space contact point
 * - Outward unit normal from the surface
 * - Coefficient of restitution
 *
 * This module does NOT detect collisions or
 * correct geometric penetration.
 *
 * Coordinates: +x right, +y up.
 * Rotation: positive counterclockwise.
 * Units: SI.
 */

export function resolveRigidContactImpulse(
    body,
    contactPoint,
    normal,
    { restitution = 0 } = {}
) {
    if (
        body?.geometry?.type !== "rectangle" ||
        body.isStatic ||
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.vel?.x) ||
        !Number.isFinite(body?.vel?.y) ||
        !Number.isFinite(body.angularVelocity) ||
        !Number.isFinite(body.invMass) ||
        !Number.isFinite(body.invInertia) ||
        body.invMass <= 0 ||
        body.invInertia <= 0 ||
        !Number.isFinite(contactPoint?.x) ||
        !Number.isFinite(contactPoint?.y) ||
        !Number.isFinite(normal?.x) ||
        !Number.isFinite(normal?.y) ||
        !Number.isFinite(restitution) ||
        restitution < 0 ||
        restitution > 1
    ) {
        throw new Error(
            "Invalid rigid contact impulse parameters."
        );
    }

    const normalLength = Math.hypot(
        normal.x,
        normal.y
    );

    if (
        !Number.isFinite(normalLength) ||
        Math.abs(normalLength - 1) > 1e-8
    ) {
        throw new Error(
            "Contact normal must have unit length."
        );
    }

    const nx = normal.x;
    const ny = normal.y;

    // Contact point relative to center of mass.
    const rx = contactPoint.x - body.pos.x;
    const ry = contactPoint.y - body.pos.y;

    // Velocity at the contact point:
    // v_contact = v_COM + omega cross r.
    const contactVxBefore =
        body.vel.x - body.angularVelocity * ry;

    const contactVyBefore =
        body.vel.y + body.angularVelocity * rx;

    const normalSpeedBefore =
        contactVxBefore * nx +
        contactVyBefore * ny;

    const cross = rx * ny - ry * nx;

    const effectiveInvMass =
        body.invMass +
        cross * cross * body.invInertia;

    let normalImpulse = 0;

    // A separating or stationary contact receives
    // no new impact impulse.
    if (normalSpeedBefore < 0) {
        normalImpulse =
            -(1 + restitution) *
            normalSpeedBefore /
            effectiveInvMass;

        body.vel.x +=
            normalImpulse * nx * body.invMass;

        body.vel.y +=
            normalImpulse * ny * body.invMass;

        body.angularVelocity +=
            cross * normalImpulse *
            body.invInertia;
    }

    const contactVxAfter =
        body.vel.x - body.angularVelocity * ry;

    const contactVyAfter =
        body.vel.y + body.angularVelocity * rx;

    const normalSpeedAfter =
        contactVxAfter * nx +
        contactVyAfter * ny;

    return Object.freeze({
        contactPoint: Object.freeze({
            x: contactPoint.x,
            y: contactPoint.y
        }),

        normal: Object.freeze({
            x: nx,
            y: ny
        }),

        restitution,
        momentArm: cross,
        effectiveInvMass,

        normalSpeedBefore,
        normalSpeedAfter,
        normalImpulse,

        linearImpulse: Object.freeze({
            x: normalImpulse * nx,
            y: normalImpulse * ny
        }),

        angularImpulse: cross * normalImpulse,

        velocityAfter: Object.freeze({
            x: body.vel.x,
            y: body.vel.y
        }),

        angularVelocityAfter:
            body.angularVelocity
    });
}
