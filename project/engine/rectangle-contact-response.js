
/*
 * Phase 5E.4.4c — Experimental simultaneous
 * rectangular contact impulses.
 *
 * Handles:
 * - One approaching top-surface contact
 * - Two simultaneously approaching contacts
 * - Stationary/separating contacts
 *
 * Uses a coupled 2x2 impulse system to avoid
 * arbitrary left-versus-right processing order.
 *
 * Limitations:
 * - Fixed horizontal surface
 * - Upward frictionless contact normals
 * - At most two contacts
 * - Mixed approach/separation cases require
 *   a later complementarity solver
 * - No positional penetration correction
 */

export function resolveRectangleContactImpulses(
    body,
    contacts,
    { restitution = 0 } = {}
) {
    if (
        body?.geometry?.type !== "rectangle" ||
        body.isStatic ||
        !Number.isFinite(body?.invMass) ||
        !Number.isFinite(body?.invInertia) ||
        body.invMass <= 0 ||
        body.invInertia <= 0 ||
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.vel?.x) ||
        !Number.isFinite(body?.vel?.y) ||
        !Number.isFinite(body?.angularVelocity) ||
        !Array.isArray(contacts) ||
        contacts.length > 2 ||
        !Number.isFinite(restitution) ||
        restitution < 0 ||
        restitution > 1
    ) {
        throw new Error(
            "Invalid rectangular contact response."
        );
    }

    const data = contacts.map(contact => {
        if (
            !Number.isFinite(contact?.point?.x) ||
            !Number.isFinite(contact?.point?.y) ||
            contact?.normal?.x !== 0 ||
            contact?.normal?.y !== 1
        ) {
            throw new Error(
                "Only upward top-surface contacts are supported."
            );
        }

        const rx = contact.point.x - body.pos.x;

        return {
            vertexId: contact.vertexId,
            point: contact.point,
            rx,
            normalSpeedBefore:
                body.vel.y +
                body.angularVelocity * rx
        };
    });

    const eps = 1e-12;

    // Both contacts must be either approaching or
    // effectively stationary. Other combinations
    // need the future active-set contact solver.
    if (data.length === 2) {
        const approaching = data.filter(
            c => c.normalSpeedBefore < -eps
        );

        if (
            approaching.length === 1 ||
            (approaching.length === 2 &&
                Math.abs(data[0].rx - data[1].rx) < eps)
        ) {
            throw new Error(
                "Mixed or degenerate two-contact case " +
                "requires active-set resolution."
            );
        }
    }

    let impulses = data.map(() => 0);

    if (data.length === 1) {
        const c = data[0];

        if (c.normalSpeedBefore < -eps) {
            const effectiveInvMass =
                body.invMass +
                c.rx ** 2 * body.invInertia;

            impulses[0] =
                -(1 + restitution) *
                c.normalSpeedBefore /
                effectiveInvMass;
        }
    }

    if (
        data.length === 2 &&
        data.every(c =>
            c.normalSpeedBefore < -eps
        )
    ) {
        const [a, b] = data;

        const k11 =
            body.invMass +
            a.rx ** 2 * body.invInertia;

        const k22 =
            body.invMass +
            b.rx ** 2 * body.invInertia;

        const k12 =
            body.invMass +
            a.rx * b.rx * body.invInertia;

        const determinant =
            k11 * k22 - k12 ** 2;

        if (
            !Number.isFinite(determinant) ||
            determinant <= eps
        ) {
            throw new Error(
                "Singular simultaneous-contact matrix."
            );
        }

        const rhs1 =
            -(1 + restitution) *
            a.normalSpeedBefore;

        const rhs2 =
            -(1 + restitution) *
            b.normalSpeedBefore;

        const j1 =
            (rhs1 * k22 - rhs2 * k12) /
            determinant;

        const j2 =
            (k11 * rhs2 - k12 * rhs1) /
            determinant;

        if (j1 < -eps || j2 < -eps) {
            throw new Error(
                "Contact impulse would be tensile; " +
                "active-set solver required."
            );
        }

        impulses = [
            Math.max(0, j1),
            Math.max(0, j2)
        ];
    }

    // Apply the combined impulse only once.
    const totalImpulse =
        impulses.reduce((sum, j) => sum + j, 0);

    const angularImpulse =
        data.reduce(
            (sum, c, i) =>
                sum + c.rx * impulses[i],
            0
        );

    body.vel.y += totalImpulse * body.invMass;

    body.angularVelocity +=
        angularImpulse * body.invInertia;

    const results = data.map((c, i) =>
        Object.freeze({
            vertexId: c.vertexId,
            normalImpulse: impulses[i],
            normalSpeedBefore:
                c.normalSpeedBefore,
            normalSpeedAfter:
                body.vel.y +
                body.angularVelocity * c.rx
        })
    );

    return Object.freeze({
        contacts: Object.freeze(results),
        totalNormalImpulse: totalImpulse,
        angularImpulse,
        verticalVelocityAfter: body.vel.y,
        angularVelocityAfter:
            body.angularVelocity
    });
}
