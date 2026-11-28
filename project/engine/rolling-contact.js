
/*
 * Experimental disk-to-pedestal rolling friction.
 *
 * Applies a horizontal friction impulse at the
 * bottom of a uniform circular disk.
 *
 * The normal impulse is supplied by the caller.
 * No normal-force calculation is performed here.
 *
 * Geometry: flat horizontal pedestal, disk fully
 * above the supporting surface.
 *
 * Coordinates: +x right, +y up,
 * positive angular velocity counterclockwise.
 */

export function applyDiskRollingFriction(
    body,
    pedestal,
    {
        muStatic,
        muKinetic,
        normalImpulse,
        contactTolerance = 1e-6
    }
) {
    if (
        body?.geometry?.type !== "disk" ||
        body.isStatic ||
        !Number.isFinite(body.radius) ||
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.vel?.x) ||
        !Number.isFinite(body.angularVelocity) ||
        !Number.isFinite(body.invMass) ||
        !Number.isFinite(body.invInertia) ||
        body.invMass <= 0 ||
        body.invInertia <= 0 ||
        !Number.isFinite(pedestal?.xMin) ||
        !Number.isFinite(pedestal?.xMax) ||
        !Number.isFinite(pedestal?.topY) ||
        pedestal.xMin >= pedestal.xMax ||
        !Number.isFinite(muStatic) ||
        !Number.isFinite(muKinetic) ||
        !Number.isFinite(normalImpulse) ||
        !Number.isFinite(contactTolerance) ||
        muKinetic < 0 ||
        muStatic < muKinetic ||
        normalImpulse < 0 ||
        contactTolerance < 0
    ) {
        throw new Error(
            "Invalid rolling-contact parameters."
        );
    }

    const R = body.radius;

    const atSurface = Math.abs(
        body.pos.y - (pedestal.topY + R)
    ) <= contactTolerance;

    const fullySupported =
        body.pos.x - R >= pedestal.xMin &&
        body.pos.x + R <= pedestal.xMax;

    if (!atSurface || !fullySupported) {
        return null;
    }

    // Relative horizontal velocity at the bottom point.
    const slipBefore =
        body.vel.x + R * body.angularVelocity;

    // Effective inverse mass in the tangent direction.
    const effectiveInvMass =
        body.invMass + R * R * body.invInertia;

    // Impulse required to remove slip in one step.
    const requiredImpulse =
        -slipBefore / effectiveInvMass;

    const staticLimit = muStatic * normalImpulse;
    const kineticLimit = muKinetic * normalImpulse;

    let frictionImpulse;
    let regime;

    if (Math.abs(requiredImpulse) <=
        staticLimit + 1e-12) {
        // Static friction can enforce no slip.
        frictionImpulse = requiredImpulse;
        regime = "static";
    } else {
        // Kinetic friction opposes relative motion.
        frictionImpulse =
            -Math.sign(slipBefore) * kineticLimit;
        regime = "kinetic";
    }

    // Tangential impulse changes translation.
    body.vel.x += frictionImpulse * body.invMass;

    // Contact point is R below the center of mass.
    // Torque impulse: (-R) × horizontal impulse.
    // In 2D, this gives +R * frictionImpulse.
    body.angularVelocity +=
        R * frictionImpulse * body.invInertia;

    const slipAfter =
        body.vel.x + R * body.angularVelocity;

    return {
        regime,
        slipBefore,
        slipAfter,
        requiredImpulse,
        frictionImpulse,
        staticLimit,
        kineticLimit,
        velocityAfter: body.vel.x,
        angularVelocityAfter: body.angularVelocity
    };
}
