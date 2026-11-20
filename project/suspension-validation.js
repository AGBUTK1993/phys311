import { SuspensionWorld } from "./engine/suspension.js";

export function runSuspensionPeriodValidation() {
    // Independent test world using the same physics as the game.
    const testWorld = new SuspensionWorld();

    testWorld.conservativeMode = true;
    testWorld.dampingRate = 0;
    testWorld.theta = 0.05; // Small initial angle, in radians.
    testWorld.omega = 0;
    testWorld.anchor.vel.x = 0;
    testWorld.supportTarget = testWorld.anchor.pos.x;
    testWorld.supportAcceleration = 0;
    testWorld.updateBodyState();

    const dt = 1 / 240;
    const crossings = [];
    let valid = true;

    for (let step = 0; step < 60 / dt; step++) {
        const previousAngle = testWorld.theta;
        const previousTime = testWorld.time;

        testWorld.step(dt);

        if (
            testWorld.stoppedForSlack ||
            !Number.isFinite(testWorld.theta) ||
            !Number.isFinite(testWorld.omega)
        ) {
            valid = false;
            break;
        }

        // Count only positive-to-negative crossings.
        // Consecutive crossings in this direction are one period apart.
        if (previousAngle > 0 && testWorld.theta <= 0) {
            const fraction =
                previousAngle / (previousAngle - testWorld.theta);

            crossings.push(previousTime + fraction * dt);
        }
    }

    const expected =
        2 * Math.PI * Math.sqrt(testWorld.length / testWorld.g);

    const measured = crossings.length >= 2
        ? (crossings[crossings.length - 1] - crossings[0]) /
          (crossings.length - 1)
        : NaN;

    const errorPercent =
        100 * Math.abs(measured - expected) / expected;

    const passed =
        valid &&
        Number.isFinite(measured) &&
        errorPercent < 1;

    console.log("Suspension small-angle period validation");
    console.table({
        "Expected period (s)": expected,
        "Measured period (s)": measured,
        "Relative error (%)": errorPercent,
        "Tolerance (%)": 1,
        "Completed periods measured": Math.max(0, crossings.length - 1),
        "PASS": passed,
    });

    return { expected, measured, errorPercent, passed };
}