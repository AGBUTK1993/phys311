import { Vec2 } from "./engine/vec2.js";
import { Body } from "./engine/body.js";
import { VelocityVerlet } from "./engine/integrators.js";
import { World } from "./engine/world.js";

// Build the same initial arrangement for every comparison.
function makeValidationWorld(restitution, useWalls) {
    const world = new World({
        integrator: new VelocityVerlet(),
        restitution,
        collisionsEnabled: true,
        bounds: useWalls
            ? { xMin: 0, xMax: 20, yMin: 0, yMax: 12 }
            : null,
    });

    // Four rows of five balls: 20 balls altogether.
    for (let row = 0; row < 4; row++) {
        for (let column = 0; column < 5; column++) {
            const index = row * 5 + column;

            world.addBody(
                new Body({
                    m: 1,
                    radius: 0.3,
                    pos: new Vec2(3 + 3 * column, 3 + 2 * row),
                    vel: new Vec2(
                        column % 2 === 0 ? 2 : -2,
                        0.6 * Math.sin(index + 1)
                    ),
                    name: `Ball ${index + 1}`,
                })
            );
        }
    }

    // No gravity or other forces: total energy is kinetic energy.
    return world;
}

// Run one experiment and measure its conservation errors.
function runValidationCase(restitution, useWalls) {
    const world = makeValidationWorld(restitution, useWalls);

    const dt = 1 / 240;
    const duration = 60;
    const numberOfSteps = Math.round(duration / dt);

    const initialEnergy = world.totalEnergy();
    const initialMomentum = world.totalMomentum();

    let previousEnergy = initialEnergy;
    let maximumEnergyDeviation = 0;
    let maximumEnergyIncrease = 0;
    let maximumMomentumDeviation = 0;

    for (let step = 0; step < numberOfSteps; step++) {
        world.step(dt);

        const energy = world.totalEnergy();
        const momentum = world.totalMomentum();

        maximumEnergyDeviation = Math.max(
            maximumEnergyDeviation,
            Math.abs(energy - initialEnergy)
        );

        // For inelastic collisions, energy should never increase.
        maximumEnergyIncrease = Math.max(
            maximumEnergyIncrease,
            energy - previousEnergy
        );

        // Compare the momentum vectors, not just their magnitudes.
        maximumMomentumDeviation = Math.max(
            maximumMomentumDeviation,
            Math.hypot(
                momentum.x - initialMomentum.x,
                momentum.y - initialMomentum.y
            )
        );

        previousEnergy = energy;
    }

    const finalEnergy = world.totalEnergy();
    const finalMomentum = world.totalMomentum();

    // Allow tiny floating-point rounding errors.
    const energyTolerance = 1e-9 * Math.max(1, initialEnergy);
    const momentumTolerance =
        1e-9 * Math.max(1, Math.hypot(
            initialMomentum.x,
            initialMomentum.y
        ));

    const energyPassed =
        restitution === 1
            ? maximumEnergyDeviation <= energyTolerance
            : maximumEnergyIncrease <= energyTolerance;

    const momentumPassed =
        maximumMomentumDeviation <= momentumTolerance;

    return {
        restitution,
        useWalls,
        initialEnergy,
        finalEnergy,
        initialMomentum,
        finalMomentum,
        maximumEnergyDeviation,
        maximumEnergyIncrease,
        maximumMomentumDeviation,
        energyPassed,
        momentumPassed,
    };
}

export function runCollisionValidation() {
    const results = [
        runValidationCase(1.0, true),
        runValidationCase(0.8, true),
        runValidationCase(1.0, false),
        runValidationCase(0.8, false),
    ];

    console.log("60-second validation: 20 balls, dt = 1/240 s");
    console.log("Energy is in J; momentum is in kg m/s.");

    console.table(
        results.map((result) => ({
            walls: result.useWalls ? "ON" : "OFF",
            e: result.restitution,
            initialEnergy: result.initialEnergy.toFixed(6),
            finalEnergy: result.finalEnergy.toFixed(6),
            initialPx: result.initialMomentum.x.toFixed(6),
            finalPx: result.finalMomentum.x.toFixed(6),
            initialPy: result.initialMomentum.y.toFixed(6),
            finalPy: result.finalMomentum.y.toFixed(6),
        }))
    );

    console.table(
        results.map((result) => ({
            walls: result.useWalls ? "ON" : "OFF",
            e: result.restitution,
            maxEnergyDeviation:
                result.maximumEnergyDeviation.toExponential(3),
            maxSingleStepEnergyIncrease:
                result.maximumEnergyIncrease.toExponential(3),
            maxMomentumDeviation:
                result.maximumMomentumDeviation.toExponential(3),
            energyCheck: result.energyPassed,
            momentumCheck: result.useWalls
                ? "Not required: wall impulses"
                : result.momentumPassed,
        }))
    );

    // Print complete numerical results for the written report.
    const reportLines = [
        "Walls | e | E0 (J) | E60 (J) | Fractional energy change | " +
        "|P0| (kg m/s) | |P60| (kg m/s)",
    ];

    for (const result of results) {
        const initialMagnitude = Math.hypot(
            result.initialMomentum.x,
            result.initialMomentum.y
        );

        const finalMagnitude = Math.hypot(
            result.finalMomentum.x,
            result.finalMomentum.y
        );

        const fractionalChange =
            (result.finalEnergy - result.initialEnergy) /
            Math.abs(result.initialEnergy);

        reportLines.push(
            [
                result.useWalls ? "ON" : "OFF",
                result.restitution.toFixed(1),
                result.initialEnergy.toFixed(9),
                result.finalEnergy.toFixed(9),
                fractionalChange.toExponential(6),
                initialMagnitude.toFixed(9),
                finalMagnitude.toFixed(9),
            ].join(" | ")
        );
    }

    console.log("REPORT TABLE\n" + reportLines.join("\n"));

    const allPassed = results.every(
        (result) =>
            result.energyPassed &&
            (result.useWalls || result.momentumPassed)
    );

    console.log("Long-run collision validation passed:", allPassed);
    console.assert(allPassed, "A long-run conservation check failed.");

    return results;
}