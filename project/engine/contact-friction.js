
/*
 * Experimental horizontal sliding friction.
 *
 * Supports a nonrotating circular body on the flat,
 * upper face of a horizontal pedestal.
 *
 * This function adds horizontal friction to body.force.
 * It does not step the body or calculate normal forces.
 *
 * Coordinates: x right, y up.
 * Units: SI.
 */

export function applyPedestalSlidingFriction(
    body,
    pedestal,
    {
        muStatic,
        muKinetic,
        normalForce,
        dt,
        contactTolerance = 1e-6
    }
) {
    if (
        body?.geometry?.type !== "disk" ||
        body.isStatic ||
        !Number.isFinite(body?.m) ||
        body.m <= 0 ||
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.vel?.x) ||
        !Number.isFinite(body?.force?.x) ||
        !Number.isFinite(body?.angularVelocity) ||
        !Number.isFinite(pedestal?.xMin) ||
        !Number.isFinite(pedestal?.xMax) ||
        !Number.isFinite(pedestal?.topY) ||
        !Number.isFinite(muStatic) ||
        !Number.isFinite(muKinetic) ||
        !Number.isFinite(normalForce) ||
        !Number.isFinite(dt) ||
        !Number.isFinite(contactTolerance) ||
        muStatic < muKinetic ||
        muKinetic < 0 ||
        normalForce < 0 ||
        dt <= 0 ||
        contactTolerance < 0
    ) {
        throw new Error("Invalid sliding-friction parameters.");
    }

    // Translation-only model: rolling is not included yet.
    if (Math.abs(body.angularVelocity) > 1e-10) {
        throw new Error(
            "Sliding-friction test does not support rotation."
        );
    }

    // The circle must be resting on the flat upper face,
    // with its entire diameter over the pedestal.
    const atSurface =
        Math.abs(
            body.pos.y - (pedestal.topY + body.radius)
        ) <= contactTolerance;

    const fullyOverSurface =
        body.pos.x - body.radius >= pedestal.xMin &&
        body.pos.x + body.radius <= pedestal.xMax;

    if (!atSurface || !fullyOverSurface) {
        return null;
    }

    // Assumes the horizontal external force is already
    // accumulated before this function is called.
    const externalFx = body.force.x;
    const vx = body.vel.x;

    const staticLimit = muStatic * normalForce;
    const kineticMagnitude = muKinetic * normalForce;

    const speedTolerance = 1e-10;
    let frictionFx;
    let regime;

    if (Math.abs(vx) <= speedTolerance &&
        Math.abs(externalFx) <= staticLimit) {
        // Static friction exactly balances applied force.
        frictionFx = -externalFx;
        regime = "static";
    } else {
        // Sliding friction opposes the sliding velocity.
        // At the onset of sliding, it opposes the
        // external force instead.
        const direction = Math.abs(vx) > speedTolerance
            ? Math.sign(vx)
            : Math.sign(externalFx);

        frictionFx = -direction * kineticMagnitude;
        regime = "kinetic";

        // If sliding could stop within one step, and
        // static friction can hold afterward, prevent
        // a numerical reversal caused by overstepping.
        if (
            Math.abs(vx) > speedTolerance &&
            Math.abs(externalFx) <= staticLimit
        ) {
            const stoppingFriction =
                -externalFx - body.m * vx / dt;

            if (
                Math.abs(stoppingFriction) <=
                kineticMagnitude + 1e-12
            ) {
                frictionFx = stoppingFriction;
                regime = "stopping";
            }
        }
    }

    body.force.x += frictionFx;

    return {
        regime,
        externalFx,
        frictionFx,
        netFx: body.force.x,
        normalForce,
        staticLimit,
        kineticMagnitude
    };
}
