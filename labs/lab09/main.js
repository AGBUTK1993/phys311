import "./checks.js";

import { runCollisionValidation } from "./validation.js";
import {
    createBoxScene,
    createGravityScene,
    createSpringScene,
} from "./scenes.js";
import {
    EulerCromer,
    VelocityVerlet,
} from "./engine/integrators.js";
import { Camera } from "./render/camera.js";
import { Renderer } from "./render/renderer.js";
import { drawHUD } from "./render/hud.js";
import { PerformanceRecorder } from "./performance.js";
import {
    capturePhysicalState,
    statesAreIdentical,
} from "./replay.js";

runCollisionValidation();

// References to the HTML elements we want to control.
const canvas = document.getElementById("sim");
const status = document.getElementById("status");
const sceneSelect = document.getElementById("sceneSelect");
const seededRunButton = document.getElementById("seededRunButton");
const replayButton = document.getElementById("replayButton");
const replayResults = document.getElementById("replayResults");

let savedReplayConfig = null;
let referenceState = null;
let bonusRunKind = null;
const bodyCountSelect = document.getElementById("bodyCountSelect");
const performanceRecorder = new PerformanceRecorder(
    document.getElementById("performanceResults")
);
const integratorSelect = document.getElementById("integratorSelect");
const restitutionInput = document.getElementById("restitutionInput");
const restitutionValue = document.getElementById("restitutionValue");
const restartButton = document.getElementById("restartButton");
const pauseButton = document.getElementById("pauseButton");

// Leave room above the box for the HUD.
canvas.height = 850;

const camera = new Camera(40, 500, 530);
const renderer = new Renderer(canvas, camera);
renderer.showTrails = true;

const DT = 1 / 240;
const DURATION = 60;
const MAX_STEPS = Math.round(DURATION / DT);

let world;
let initialEnergy;
let maximumRelativeEnergyError = 0;
let initialMomentum;
let maximumMomentumDeviation = 0;
let completedSteps = 0;
let accumulator = 0;
let previousTimestamp = null;
let paused = false;
let finished = false;

const stats = {
    fps: 0,
    physicsMs: 0,
    renderMs: 0,
};

// Construct the method currently selected in the dropdown.
function selectedIntegrator() {
    return integratorSelect.value === "verlet"
        ? new VelocityVerlet()
        : new EulerCromer();
}

function startBonusRun(isReplay) {
    if (isReplay && referenceState === null) return;

    if (!isReplay) {
        savedReplayConfig = {
            seed: 31109,
            count: Number(bodyCountSelect.value),
            restitution: Number(restitutionInput.value),
            method: integratorSelect.value,
        };

        referenceState = null;
    }

    // Restore the saved settings before rebuilding the world.
    sceneSelect.value = "box";
    bodyCountSelect.value = String(savedReplayConfig.count);
    restitutionInput.value = String(savedReplayConfig.restitution);
    integratorSelect.value = savedReplayConfig.method;

    restartSimulation();

    // Replace the ordinary box with its seeded version.
    world = createBoxScene({
        count: savedReplayConfig.count,
        restitution: savedReplayConfig.restitution,
        integrator: selectedIntegrator(),
        seed: savedReplayConfig.seed,
    });

    initialEnergy = world.totalEnergy();
    initialMomentum = world.totalMomentum();

    // Keep this experiment separate from the performance measurements.
    performanceRecorder.stop();

    bonusRunKind = isReplay ? "replay" : "reference";

    // Hold the physics settings fixed throughout the comparison.
    sceneSelect.disabled = true;
    bodyCountSelect.disabled = true;
    integratorSelect.disabled = true;
    restitutionInput.disabled = true;
    seededRunButton.disabled = true;
    replayButton.disabled = true;

    replayResults.textContent = isReplay
        ? "Replay running: comparing with the saved reference run."
        : `Reference run started with seed ${savedReplayConfig.seed}.`;

    status.textContent =
        "Seeded box simulation — 60 simulated seconds.";
}

function finishBonusRun() {
    if (bonusRunKind === null) return;

    const finalState = capturePhysicalState(
        world,
        DT,
        completedSteps
    );

    if (bonusRunKind === "reference") {
        referenceState = finalState;

        replayResults.textContent =
            `Reference saved: seed ${savedReplayConfig.seed}, ` +
            `${completedSteps} steps. Click Replay.`;
    } else {
        const identical = statesAreIdentical(
            referenceState,
            finalState
        );

        replayResults.textContent =
            `Seed: ${savedReplayConfig.seed} | ` +
            `Steps per run: ${completedSteps} | ` +
            `Compared bytes: ${finalState.length} | ` +
            `Bit-identical final physical states: ${identical}`;

        console.log(replayResults.textContent);
        console.assert(identical, "Replay states did not match.");
    }

    bonusRunKind = null;

    sceneSelect.disabled = false;
    bodyCountSelect.disabled = false;
    integratorSelect.disabled = false;
    restitutionInput.disabled = false;
    seededRunButton.disabled = false;
    replayButton.disabled = false;
}

// Replace the old world with a fresh copy of the initial scene.
function restartSimulation() {
    // Restart also lets the user leave an unfinished bonus run.
    if (bonusRunKind !== null) {
        replayResults.textContent =
            "Bonus run interrupted. Start a new seeded run or replay a saved reference.";
    }

    bonusRunKind = null;
    sceneSelect.disabled = false;
    integratorSelect.disabled = false;
    seededRunButton.disabled = false;
    replayButton.disabled = referenceState === null;

    const scene = sceneSelect.value;
    const integrator = selectedIntegrator();

    if (scene === "box") {
        world = createBoxScene({
            count: Number(bodyCountSelect.value),
            restitution: Number(restitutionInput.value),
            integrator,
        });

        camera.scale = 40;
        camera.originX = 100;
        camera.originY = 800;

        renderer.showTrails = false;
        restitutionInput.disabled = false;
    } else if (scene === "gravity") {
        world = createGravityScene({ integrator });

        camera.scale = 40;
        camera.originX = 500;
        camera.originY = 530;

        renderer.showTrails = true;
        restitutionInput.disabled = true;
    } else {
        world = createSpringScene({ integrator });

        camera.scale = 40;
        camera.originX = 500;
        camera.originY = 530;

        renderer.showTrails = false;
        restitutionInput.disabled = true;
    }

    initialEnergy = world.totalEnergy();
    bodyCountSelect.disabled = scene !== "box";

    if (scene === "box") {
        performanceRecorder.start(
            world.bodies.length,
            integratorSelect.value,
            world.restitution
        );
    } else {
        performanceRecorder.stop();
    }
    initialMomentum = world.totalMomentum();
    maximumRelativeEnergyError = 0;
    maximumMomentumDeviation = 0;

    completedSteps = 0;
    accumulator = 0;
    previousTimestamp = null;
    paused = false;
    finished = false;

    stats.fps = 0;
    stats.physicsMs = 0;
    stats.renderMs = 0;

    restitutionValue.textContent =
        Number(restitutionInput.value).toFixed(2);

    pauseButton.textContent = "Pause";
    pauseButton.disabled = false;

    const sceneName =
        sceneSelect.options[sceneSelect.selectedIndex].text;

    status.textContent =
        `${sceneName} running — 60 simulated seconds.`;
}

// Event listeners run their functions when the user uses a control.
restartButton.addEventListener("click", restartSimulation);
seededRunButton.addEventListener("click", () => {
    startBonusRun(false);
});

replayButton.addEventListener("click", () => {
    startBonusRun(true);
});

sceneSelect.addEventListener("change", restartSimulation);
bodyCountSelect.addEventListener("change", restartSimulation);

pauseButton.addEventListener("click", () => {
    performanceRecorder.stop();

    if (finished) return;

    paused = !paused;
    accumulator = 0;
    previousTimestamp = null;

    pauseButton.textContent = paused ? "Resume" : "Pause";
    status.textContent = paused
        ? "Simulation paused."
        : "Simulation running.";
});

integratorSelect.addEventListener("change", () => {
    performanceRecorder.stop();

    world.integrator = selectedIntegrator();
});

restitutionInput.addEventListener("input", () => {
    performanceRecorder.stop();

    world.restitution = Number(restitutionInput.value);
    restitutionValue.textContent = world.restitution.toFixed(2);
});

function reportCompletion() {
    finishBonusRun();
    
    const finalEnergy = world.totalEnergy();
    console.log(
        "Maximum relative energy error:",
        maximumRelativeEnergyError.toExponential(6)
    );

    console.log(
        "Maximum energy error (%):",
        (100 * maximumRelativeEnergyError).toExponential(6)
    );

    console.log(
        "Maximum momentum-vector deviation:",
        maximumMomentumDeviation.toExponential(6),
        "kg m/s"
    );

    console.log("Simulation completed: 60 simulated seconds.");
    console.log("Initial energy:", initialEnergy.toFixed(6), "J");
    console.log("Final energy:", finalEnergy.toFixed(6), "J");
    console.log(
        "Relative energy change:",
        ((finalEnergy - initialEnergy) / Math.abs(initialEnergy))
            .toExponential(3)
    );

    status.textContent =
        "60 simulated seconds complete. Click Restart to run again.";

    pauseButton.textContent = "Complete";
    pauseButton.disabled = true;
}

function frame(timestamp) {
    if (previousTimestamp === null) {
        previousTimestamp = timestamp;
    }

    const elapsed = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;

    if (elapsed > 0) {
        const currentFPS = 1 / elapsed;

        stats.fps =
            stats.fps === 0
                ? currentFPS
                : 0.9 * stats.fps + 0.1 * currentFPS;
    }

    const timeBeforeFrame = world.time;
    const physicsStart = performance.now();

    if (!paused && !finished) {
        accumulator += Math.min(elapsed, 0.1);

        while (accumulator >= DT && completedSteps < MAX_STEPS) {
            world.step(DT);
            const energy = world.totalEnergy();
            const momentum = world.totalMomentum();

            if (initialEnergy !== 0) {
                const relativeEnergyError =
                    Math.abs(energy - initialEnergy) / Math.abs(initialEnergy);

                maximumRelativeEnergyError = Math.max(
                    maximumRelativeEnergyError,
                    relativeEnergyError
                );
            }

            maximumMomentumDeviation = Math.max(
                maximumMomentumDeviation,
                Math.hypot(
                    momentum.x - initialMomentum.x,
                    momentum.y - initialMomentum.y
                )
            );
            accumulator -= DT;
            completedSteps++;
        }
    }

    stats.physicsMs = performance.now() - physicsStart;

    if (!finished && completedSteps >= MAX_STEPS) {
        finished = true;
        accumulator = 0;
        reportCompletion();
    }

    const renderStart = performance.now();

    renderer.draw(world);
    drawHUD(renderer.ctx, world, initialEnergy, stats);

    stats.renderMs = performance.now() - renderStart;

    if (!paused && !finished) {
        performanceRecorder.record(
            elapsed,
            stats.physicsMs,
            stats.renderMs,
            world.time - timeBeforeFrame
        );
    }

    // Keep drawing so controls still work after pausing or finishing.
    requestAnimationFrame(frame);
}

restartSimulation();
requestAnimationFrame(frame);