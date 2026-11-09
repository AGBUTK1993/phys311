// Encode the physical state as the actual bytes of Float64 numbers.
export function capturePhysicalState(world, dt, steps) {
    const values = [
        dt,
        steps,
        world.time,
        world.restitution,
        world.bodies.length,
    ];

    // Match bodies by their creation order within the scene.
    for (const body of world.bodies) {
        values.push(
            body.m,
            body.radius,
            body.invMass,
            body.isStatic ? 1 : 0,
            body.pos.x,
            body.pos.y,
            body.vel.x,
            body.vel.y,
            body.acc.x,
            body.acc.y,
            body.force.x,
            body.force.y
        );
    }

    const buffer = new ArrayBuffer(values.length * 8);
    const view = new DataView(buffer);

    values.forEach((value, index) => {
        view.setFloat64(index * 8, value, true);
    });

    return new Uint8Array(buffer);
}

export function statesAreIdentical(first, second) {
    if (first.length !== second.length) return false;

    return first.every((byte, index) => byte === second[index]);
}