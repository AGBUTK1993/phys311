// Experimental 2D rigid-body integrator.
//
// Advances translation and rotation together.
// Not yet connected to the existing game worlds.
//
// Coordinate convention:
// x right, y up, positive rotation counterclockwise.

export function stepRigidBody(body, dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
        throw new Error("Timestep must be finite and positive.");
    }

    if (body.isStatic) {
        body.clearForce();
        body.clearTorque();
        return;
    }

    // Translational acceleration: F = ma.
    body.acc.set(
        body.force.x * body.invMass,
        body.force.y * body.invMass
    );

    // Semi-implicit Euler: update velocity first.
    body.vel.addScaled(body.acc, dt);
    body.pos.addScaled(body.vel, dt);

    // Rotational acceleration: torque = I * alpha.
    // stepRotation also clears accumulated torque.
    body.stepRotation(dt);

    // Clear the force accumulator for the next timestep.
    body.clearForce();
}