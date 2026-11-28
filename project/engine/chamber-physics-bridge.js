
/*
 * Phase 5E.1 — Chamber physics integration bridge.
 *
 * Read-only snapshot of the current playable
 * suspension world.
 *
 * Does not advance simulation time, mutate bodies,
 * apply forces, or change gameplay.
 */

export function inspectChamberPhysics(world) {
    const body = world?.load;
    const anchor = world?.anchor;
    const level = world?.liftLevel;

    if (
        !body ||
        !anchor ||
        !level ||
        !level.artifact ||
        !Number.isFinite(world.time) ||
        !Number.isFinite(body.m) ||
        body.m <= 0 ||
        !Number.isFinite(body.pos.x) ||
        !Number.isFinite(body.pos.y) ||
        !Number.isFinite(body.vel.x) ||
        !Number.isFinite(body.vel.y) ||
        !Number.isFinite(anchor.pos.x) ||
        !Number.isFinite(anchor.pos.y) ||
        !Number.isFinite(world.length) ||
        !Number.isFinite(world.tension) ||
        !Number.isFinite(world.breakStrength) ||
        !Number.isFinite(body.inertia) ||
        !Number.isFinite(body.angle) ||
        !Number.isFinite(body.angularVelocity)
    ) {
        throw new Error(
            "Invalid playable chamber physics state."
        );
    }

    if (
        body.artifactId !== level.artifact.id ||
        Math.abs(body.m - level.artifact.mass) > 1e-10 ||
        body.geometry?.type !==
            level.artifact.geometry?.type
    ) {
        throw new Error(
            "Artifact definition and live body disagree."
        );
    }

    const geometry = Object.freeze({
        ...body.geometry
    });

    const artifact = Object.freeze({
        id: body.artifactId,
        name: body.name,
        mass: body.m,
        geometry,
        inertia: body.inertia
    });

    const position = Object.freeze({
        x: body.pos.x,
        y: body.pos.y
    });

    const velocity = Object.freeze({
        x: body.vel.x,
        y: body.vel.y
    });

    const support = Object.freeze({
        x: anchor.pos.x,
        y: anchor.pos.y
    });

    const rope = Object.freeze({
        state: world.ropeState,
        length: world.length,
        tension: world.tension,
        breakingStrength: world.breakStrength
    });

    return Object.freeze({
        levelId: level.id,
        levelIndex: world.liftLevelIndex,
        time: world.time,

        artifact,
        position,
        velocity,
        support,
        rope,

        angle: body.angle,
        angularVelocity: body.angularVelocity,

        model: "legacy-suspension-readonly",
        experimentalPhysicsActive: false
    });
}
