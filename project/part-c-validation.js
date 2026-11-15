import { World } from "./engine/world.js";
import { Body } from "./engine/body.js";
import { Vec2 } from "./engine/vec2.js";
import { Gravity } from "./engine/forces.js";
import { VelocityVerlet, EulerCromer } from "./engine/integrators.js";
import { resolvePair, resolveWalls } from "./engine/collisions.js";

// Operational limits for this small educational sandbox, not a stability proof.
// Stop and reset visibly instead of clipping velocities or inventing new physics.
export function assertUsableState(world) {
    if (!Number.isFinite(world.time)) throw new Error("Non-finite simulation time.");
    for (const b of world.bodies) {
        const values = [b.pos.x, b.pos.y, b.vel.x, b.vel.y,
            b.acc.x, b.acc.y, b.force.x, b.force.y];
        if (!values.every(Number.isFinite)) {
            throw new Error("A body developed a non-finite state.");
        }
        if (Math.hypot(b.pos.x, b.pos.y) > 1e6 ||
            Math.hypot(b.vel.x, b.vel.y) > 1e6) {
            throw new Error("Motion exceeded the sandbox's numerical limits.");
        }
    }
    if (!Number.isFinite(world.totalEnergy())) {
        throw new Error("Total energy became non-finite.");
    }
}

function projectile(method, dt) {
    const world = new World({ integrator: method, collisionsEnabled: false });
    const ball = world.addBody(new Body({
        m: 1, pos: new Vec2(2, 5), vel: new Vec2(3, 4),
    }));
    world.addForce(new Gravity(2));
    const initialEnergy = world.totalEnergy();
    let positionError = 0, velocityError = 0, energyError = 0;
    const steps = Math.round(60 / dt);
    for (let step = 1; step <= steps; step++) {
        world.step(dt);
        // The independent reference uses integer step count, not world.time.
        const t = step * dt;
        positionError = Math.max(positionError, Math.hypot(
            ball.pos.x - (2 + 3 * t),
            ball.pos.y - (5 + 4 * t - t * t)));
        velocityError = Math.max(velocityError,
            Math.hypot(ball.vel.x - 3, ball.vel.y - (4 - 2 * t)));
        energyError = Math.max(energyError,
            Math.abs(world.totalEnergy() - initialEnergy) / Math.abs(initialEnergy));
    }
    return { positionError, velocityError, energyError, steps };
}

export function runPartCValidation() {
    const rows = [];
    const add = (test, measured, expected, tolerance, unit = "") => {
        rows.push({ test, measured, expected, tolerance, unit,
            passed: Number.isFinite(measured) && Math.abs(measured - expected) <= tolerance });
    };
    const vv = projectile(new VelocityVerlet(), 1 / 240);
    add("60 s Verlet: maximum position error", vv.positionError, 0, 1e-7, "m");
    add("60 s Verlet: maximum velocity error", vv.velocityError, 0, 1e-8, "m/s");
    add("60 s Verlet: maximum relative energy error", vv.energyError, 0, 1e-8);

    // Under constant acceleration, Euler–Cromer position error is g*T*dt/2.
    const coarse = projectile(new EulerCromer(), 1 / 240);
    const fine = projectile(new EulerCromer(), 1 / 480);
    add("Euler–Cromer position error, dt=1/240", coarse.positionError, 0.25, 1e-7, "m");
    add("Euler–Cromer position error, dt=1/480", fine.positionError, 0.125, 1e-7, "m");
    add("Euler–Cromer error ratio (first order)", coarse.positionError / fine.positionError, 2, 1e-5);

    for (const e of [1, 0.8, 0]) {
        const bounds = { xMin: 0, xMax: 20, yMin: 0, yMax: 12 };
        const ball = new Body({ pos: new Vec2(10, 0.1), vel: new Vec2(3, -4), radius: 0.2 });
        resolveWalls(ball, bounds, e);
        add(`Floor e=${e}: upward velocity`, ball.vel.y, 4 * e, 1e-12, "m/s");
        add(`Floor e=${e}: tangential velocity`, ball.vel.x, 3, 1e-12, "m/s");
        add(`Floor e=${e}: kinetic energy`, ball.kineticEnergy(), 4.5 + 8 * e * e, 1e-12, "J");
    }
    for (const e of [1, 0.8, 0]) {
        const a = new Body({ m: 2, pos: new Vec2(0, 0), vel: new Vec2(4, 0), radius: 1 });
        const b = new Body({ m: 3, pos: new Vec2(1.9, 0), vel: new Vec2(0, 0), radius: 1 });
        resolvePair(a, b, e);
        add(`Pair e=${e}: momentum`, 2 * a.vel.x + 3 * b.vel.x, 8, 1e-12, "kg m/s");
        add(`Pair e=${e}: kinetic energy`, a.kineticEnergy() + b.kineticEnergy(),
            16 - 9.6 * (1 - e * e), 1e-12, "J");
    }
    const probe = new World();
    const invalid = probe.addBody(new Body());
    invalid.pos.x = NaN;
    let rejected = false;
    try { assertUsableState(probe); } catch { rejected = true; }
    add("Guard rejects an injected NaN in a separate test world", Number(rejected), 1, 0);
    console.group("Part C: projectile and collision validation");
    console.log("Separate test worlds; g=2 m/s²; initial position=(2,5) m; velocity=(3,4) m/s.");
    console.log("Free flight has NO walls or other balls. It tests the engine against the analytic preview formula, not pointer mapping.");
    console.table(rows);
    const passed = rows.every(row => row.passed);
    console.log("Part C validation passed:", passed);
    console.groupEnd();
    return { passed, rows, steps: vv.steps };
}
