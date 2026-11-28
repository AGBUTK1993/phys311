
/*
 * Experimental rectangular-artifact tipping.
 *
 * 1. Evaluate static support and gravitational torque.
 * 2. Simulate rotation about a fixed pedestal-edge pivot.
 *
 * Assumptions:
 * - Uniform rectangular rigid body.
 * - Horizontal pedestal.
 * - Body starts horizontal and motionless.
 * - Gravity is the only applied force.
 * - Pivot remains fixed without slipping.
 *
 * Not a general collision or friction solver.
 */

import {
    evaluateRectanglePedestalSupport
} from "./contact-geometry.js";

export function assessPedestalTipping(
    body,
    pedestal,
    gravity = 9.81
) {
    if (
        body?.geometry?.type !== "rectangle" ||
        body.isStatic ||
        !Number.isFinite(body.m) ||
        !Number.isFinite(body.inertia) ||
        !Number.isFinite(gravity) ||
        gravity <= 0
    ) {
        throw new Error("Invalid tipping assessment.");
    }

    const support = evaluateRectanglePedestalSupport(
        body,
        pedestal
    );

    if (!support.touching) {
        return {
            ...support,
            equilibriumPossible: false,
            tippingDirection: "no flat contact",
            pivot: null,
            gravityTorque: null
        };
    }

    const left = support.supportInterval.min;
    const right = support.supportInterval.max;
    const x = body.pos.x;
    const tolerance = 1e-10;

    let pivotX = null;
    let tippingDirection = "none";

    if (x > right + tolerance) {
        pivotX = right;
        tippingDirection = "clockwise";
    } else if (x < left - tolerance) {
        pivotX = left;
        tippingDirection = "counterclockwise";
    }

    const pivot = pivotX === null
        ? null
        : { x: pivotX, y: pedestal.topY };

    return {
        ...support,
        equilibriumPossible: pivot === null,
        tippingDirection,
        pivot,
        gravityTorque: pivot
            ? -body.m * gravity * (x - pivot.x)
            : 0
    };
}

/*
 * Construct a fixed-pivot tipping experiment.
 *
 * Requires a flat, initially stationary artifact
 * whose COM lies outside the supported interval.
 */
export function createPedestalTippingState(
    body,
    pedestal,
    gravity = 9.81
) {
    const assessment = assessPedestalTipping(
        body, pedestal, gravity
    );

    if (
        !assessment.touching ||
        assessment.equilibriumPossible ||
        Math.abs(body.angle) > 1e-10 ||
        Math.abs(body.vel.x) > 1e-10 ||
        Math.abs(body.vel.y) > 1e-10 ||
        Math.abs(body.angularVelocity) > 1e-10
    ) {
        throw new Error(
            "Tipping requires a stationary, horizontal, " +
            "unsupported rectangle."
        );
    }

    const pivot = assessment.pivot;

    // The initial COM offset from the fixed pivot.
    const initialOffset = {
        x: body.pos.x - pivot.x,
        y: body.pos.y - pivot.y
    };

    const pivotInertia =
        body.inertia +
        body.m * (
            initialOffset.x ** 2 +
            initialOffset.y ** 2
        );

    return {
        body,
        pedestal,
        gravity,
        pivot,
        initialOffset,
        pivotInertia,
        initialEnergy:
            body.m * gravity * body.pos.y
    };
}

/*
 * Semi-implicit Euler for a rigid body rotating
 * about a stationary pivot.
 *
 * This replaces the free-body integrator ONLY
 * for this isolated experiment.
 */
export function stepPedestalTipping(state, dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
        throw new Error("Invalid tipping timestep.");
    }

    const {
        body,
        pivot,
        initialOffset,
        pivotInertia,
        gravity
    } = state;

    const cos = Math.cos(body.angle);
    const sin = Math.sin(body.angle);

    // Current COM offset relative to pivot.
    const rx =
        initialOffset.x * cos -
        initialOffset.y * sin;

    // Gravity acts downward.
    const torque = -body.m * gravity * rx;
    const alpha = torque / pivotInertia;

    // Semi-implicit Euler.
    body.angularAcceleration = alpha;
    body.angularVelocity += alpha * dt;
    body.angle += body.angularVelocity * dt;

    // Reconstruct COM position from the fixed pivot.
    const c = Math.cos(body.angle);
    const s = Math.sin(body.angle);

    const newRx =
        initialOffset.x * c -
        initialOffset.y * s;

    const newRy =
        initialOffset.x * s +
        initialOffset.y * c;

    body.pos.set(
        pivot.x + newRx,
        pivot.y + newRy
    );

    // Velocity from rigid rotation about the pivot.
    body.vel.set(
        -body.angularVelocity * newRy,
        body.angularVelocity * newRx
    );

    const kineticEnergy =
        0.5 * pivotInertia *
        body.angularVelocity ** 2;

    const potentialEnergy =
        body.m * gravity * body.pos.y;

    return {
        angle: body.angle,
        angularVelocity: body.angularVelocity,
        angularAcceleration: alpha,
        gravityTorque: torque,
        kineticEnergy,
        potentialEnergy,
        totalEnergy: kineticEnergy + potentialEnergy
    };
}
