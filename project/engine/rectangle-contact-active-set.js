
/*
 * Phase 5E.4.5 — Experimental active-set
 * normal-contact impulse solver.
 *
 * Supports up to two upward, frictionless contacts
 * against a stationary horizontal surface.
 *
 * Enumerates possible active contact sets.
 * Rejects tensile impulses and unresolved inward
 * contact velocities.
 *
 * Does not perform position correction, friction,
 * continuous collision detection, or rope updates.
 */

export function resolveRectangleActiveContacts(
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
        throw new Error("Invalid active-set contact inputs.");
    }

    const data = contacts.map(contact => {
        if (
            !Number.isFinite(contact?.point?.x) ||
            !Number.isFinite(contact?.point?.y) ||
            contact?.normal?.x !== 0 ||
            contact?.normal?.y !== 1
        ) {
            throw new Error(
                "Only upward horizontal-surface normals are supported."
            );
        }

        const rx = contact.point.x - body.pos.x;
        const before =
            body.vel.y + body.angularVelocity * rx;

        return {
            vertexId: contact.vertexId,
            rx,
            before
        };
    });

    const n = data.length;

    if (n === 0) {
        return Object.freeze({
            contacts: Object.freeze([]),
            totalNormalImpulse: 0,
            angularImpulse: 0,
            verticalVelocityAfter: body.vel.y,
            angularVelocityAfter: body.angularVelocity
        });
    }

    // Contact impulse response matrix.
    const K = data.map(a =>
        data.map(b =>
            body.invMass +
            a.rx * b.rx * body.invInertia
        )
    );

    // Restitution target applies to approaching
    // contacts only. Positive before-speed is
    // already separating.
    const q = data.map(c =>
        c.before +
        restitution * Math.min(c.before, 0)
    );

    const eps = 1e-9;
    const tolerance =
        1e-8 * Math.max(1, ...q.map(Math.abs));

    let solution = null;

    // Enumerate none, contact 0, contact 1,
    // and both contacts (when n = 2).
    for (let mask = 0; mask < (1 << n); mask++) {
        const active = [];

        for (let i = 0; i < n; i++) {
            if (mask & (1 << i)) active.push(i);
        }

        const j = Array(n).fill(0);

        if (active.length === 1) {
            const a = active[0];

            if (K[a][a] <= eps) continue;

            j[a] = -q[a] / K[a][a];
        }

        if (active.length === 2) {
            const [a, b] = active;

            const determinant =
                K[a][a] * K[b][b] -
                K[a][b] * K[b][a];

            if (determinant <= eps) continue;

            j[a] = (
                -q[a] * K[b][b] +
                q[b] * K[a][b]
            ) / determinant;

            j[b] = (
                -q[b] * K[a][a] +
                q[a] * K[b][a]
            ) / determinant;
        }

        if (j.some(value => value < -eps)) {
            continue;
        }

        const w = q.map((value, i) =>
            value + j.reduce(
                (sum, impulse, k) =>
                    sum + K[i][k] * impulse,
                0
            )
        );

        const valid = w.every((value, i) =>
            active.includes(i)
                ? Math.abs(value) <= tolerance
                : value >= -tolerance
        );

        if (valid) {
            solution = j.map(value =>
                Math.max(0, value)
            );
            break;
        }
    }

    if (solution === null) {
        throw new Error(
            "No admissible active contact set found."
        );
    }

    const totalNormalImpulse =
        solution.reduce((sum, j) => sum + j, 0);

    const angularImpulse =
        data.reduce(
            (sum, contact, i) =>
                sum + contact.rx * solution[i],
            0
        );

    // Apply the combined solution once.
    body.vel.y +=
        totalNormalImpulse * body.invMass;

    body.angularVelocity +=
        angularImpulse * body.invInertia;

    const results = data.map((contact, i) =>
        Object.freeze({
            vertexId: contact.vertexId,
            normalImpulse: solution[i],
            normalSpeedBefore: contact.before,
            normalSpeedAfter:
                body.vel.y +
                body.angularVelocity * contact.rx
        })
    );

    return Object.freeze({
        contacts: Object.freeze(results),
        totalNormalImpulse,
        angularImpulse,
        verticalVelocityAfter: body.vel.y,
        angularVelocityAfter: body.angularVelocity
    });
}
