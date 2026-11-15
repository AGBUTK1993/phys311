import { Vec2 } from "./engine/vec2.js";
import { Body } from "./engine/body.js";
import { World } from "./engine/world.js";
import { VelocityVerlet } from "./engine/integrators.js";
import {
    Gravity,
    NewtonGravity,
    Spring,
} from "./engine/forces.js";
import { createSeededRandom } from "./random.js";

// Create a fresh world containing a box of moving balls.
export function createBoxScene({
    count = 20,
    restitution = 1,
    integrator = new VelocityVerlet(),
    seed = null,
} = {}) {
    const random =
        seed === null ? null : createSeededRandom(seed);

    const world = new World({
        integrator,
        bounds: {
            xMin: 0,
            xMax: 20,
            yMin: 0,
            yMax: 12,
        },
        restitution,
        collisionsEnabled: true,
    });

    // Arrange the balls on a grid with space between them.
    const columns = Math.ceil(Math.sqrt(count * 20 / 12));
    const rows = Math.ceil(count / columns);

    const spacingX = 18 / columns;
    const spacingY = 10 / rows;

    for (let index = 0; index < count; index++) {
        const column = index % columns;
        const row = Math.floor(index / columns);

        const x = 1 + (column + 0.5) * spacingX;
        const y = 1 + (row + 0.5) * spacingY;

        // Use seeded velocities when a seed is supplied.
        // Otherwise, preserve the original box-scene setup.
        const angle =
            random === null
                ? index * 2.399963229728653
                : 2 * Math.PI * random();

        const speed =
            random === null
                ? 1.5 + 0.25 * (index % 5)
                : 1.5 + random();

        world.addBody(
            new Body({
                m: 1,
                radius: 0.2,
                pos: new Vec2(x, y),
                vel: new Vec2(
                    speed * Math.cos(angle),
                    speed * Math.sin(angle)
                ),
                name: "",
            })
        );
    }

    // Start with gravity off; the UI can change its strength live.
    world.addForce(new Gravity(0));

    return world;
}

// Create three bodies interacting through softened gravity.
export function createGravityScene({
    integrator = new VelocityVerlet(),
} = {}) {
    const G = 1;
    const softening = 0.05;
    const centralMass = 100;

    const world = new World({
        integrator,
        bounds: null,
        collisionsEnabled: false,
    });

    world.addBody(
        new Body({
            m: centralMass,
            radius: 0.35,
            pos: new Vec2(0, 0),
            vel: new Vec2(0, 0),
            name: "Central body",
        })
    );

    const orbiters = [
        { mass: 0.1, distance: 3, angle: 0, name: "Inner body" },
        { mass: 0.1, distance: 6, angle: Math.PI, name: "Outer body" },
    ];

    for (const orbiter of orbiters) {
        const r = orbiter.distance;
        const angle = orbiter.angle;

        // Approximate circular speed for the softened central force.
        const speed = Math.sqrt(
            (G * centralMass * r * r) /
            Math.pow(r * r + softening * softening, 1.5)
        );

        world.addBody(
            new Body({
                m: orbiter.mass,
                radius: 0.15,
                pos: new Vec2(
                    r * Math.cos(angle),
                    r * Math.sin(angle)
                ),
                vel: new Vec2(
                    -speed * Math.sin(angle),
                    speed * Math.cos(angle)
                ),
                name: orbiter.name,
            })
        );
    }

    // Find the initial center of mass and its velocity.
    let totalMass = 0;
    let weightedX = 0;
    let weightedY = 0;
    let momentumX = 0;
    let momentumY = 0;

    for (const body of world.bodies) {
        totalMass += body.m;
        weightedX += body.m * body.pos.x;
        weightedY += body.m * body.pos.y;
        momentumX += body.m * body.vel.x;
        momentumY += body.m * body.vel.y;
    }

    const centerX = weightedX / totalMass;
    const centerY = weightedY / totalMass;
    const centerVX = momentumX / totalMass;
    const centerVY = momentumY / totalMass;

    // Express the initial state in the center-of-mass frame.
    for (const body of world.bodies) {
        body.pos.x -= centerX;
        body.pos.y -= centerY;
        body.vel.x -= centerVX;
        body.vel.y -= centerVY;
    }

    world.addForce(new NewtonGravity(G, softening));

    return world;
}

// Four moving masses connected to a fixed anchor by springs.
export function createSpringScene({
    integrator = new VelocityVerlet(),
} = {}) {
    const world = new World({
        integrator,
        bounds: null,
        collisionsEnabled: false,
    });

    const restLength = 1.5;
    const stiffness = 10;

    const anchor = world.addBody(
        new Body({
            pos: new Vec2(0, 0),
            radius: 0.18,
            isStatic: true,
            name: "Anchor",
        })
    );

    let previousBody = anchor;

    for (let index = 1; index <= 4; index++) {
        const body = world.addBody(
            new Body({
                m: 1,
                radius: 0.15,
                pos: new Vec2(
                    index * restLength,
                    index === 4 ? 0.5 : 0
                ),
                vel: new Vec2(
                    0,
                    index % 2 === 0 ? 0.2 : -0.2
                ),
                name: `Mass ${index}`,
            })
        );

        world.addForce(
            new Spring(previousBody, body, stiffness, restLength)
        );

        previousBody = body;
    }

    return world;
}