
/*
 * Phase 5D.1 — Impact energy analysis.
 *
 * Analyzes a circular rigid body's normal collision
 * with an immovable surface.
 *
 * Uses post-collision data from contact-response.js.
 *
 * No damage thresholds, fracture model, or changes
 * to simulation state.
 *
 * Units:
 *   mass: kg
 *   velocity: m/s
 *   impulse: N s
 *   energy: J
 */

export function analyzeCircleImpact(body, collision) {
    if (collision === null) {
        return null;
    }

    const m = body?.m;
    const before = collision?.normalVelocityBefore;
    const after = collision?.normalVelocityAfter;
    const impulse = collision?.normalImpulse;

    if (
        body?.geometry?.type !== "disk" ||
        !Number.isFinite(m) ||
        m <= 0 ||
        !Number.isFinite(before) ||
        !Number.isFinite(after) ||
        !Number.isFinite(impulse) ||
        impulse < 0
    ) {
        throw new Error("Invalid impact-analysis inputs.");
    }

    // No incoming normal motion means no impact event.
    // An already-separating overlap is not a new collision.
    if (before >= 0) {
        return null;
    }

    const incomingSpeed = -before;
    const outgoingSpeed = Math.max(0, after);

    // Energy associated with motion normal to contact.
    const normalEnergyBefore =
        0.5 * m * before ** 2;

    const normalEnergyAfter =
        0.5 * m * after ** 2;

    const rawEnergyLoss =
        normalEnergyBefore - normalEnergyAfter;

    // Small floating-point roundoff can produce
    // negative values near perfectly elastic impacts.
    const tolerance = 1e-10 * Math.max(
        1,
        normalEnergyBefore,
        normalEnergyAfter
    );

    if (rawEnergyLoss < -tolerance) {
        throw new Error(
            "Collision unexpectedly gained normal energy."
        );
    }

    const dissipatedEnergy = Math.max(
        0,
        rawEnergyLoss
    );

    // Restitution inferred from actual velocities.
    const measuredRestitution =
        outgoingSpeed / incomingSpeed;

    // Momentum change implied by the velocities.
    const impulseFromVelocity =
        m * (after - before);

    const impulseError = Math.abs(
        impulse - impulseFromVelocity
    );

    const impulseTolerance =
        1e-9 * Math.max(
            1,
            Math.abs(impulse),
            Math.abs(impulseFromVelocity)
        );

    if (impulseError > impulseTolerance) {
        throw new Error(
            "Collision impulse disagrees with momentum change."
        );
    }

    return {
        pedestalId: collision.pedestalId,
        mass: m,

        incomingNormalSpeed: incomingSpeed,
        outgoingNormalSpeed: outgoingSpeed,

        measuredRestitution,
        normalImpulse: impulse,

        normalEnergyBefore,
        normalEnergyAfter,
        dissipatedEnergy,

        energyLossFraction:
            dissipatedEnergy / normalEnergyBefore,

        impulseConsistencyError: impulseError
    };
}
