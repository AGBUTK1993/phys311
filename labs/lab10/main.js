import "./checks.js";

import { runCollisionValidation } from "./validation.js";
import {
    createBoxScene,
    createGravityScene,
    createSpringScene,
} from "./scenes.js";
import {
    Euler,
    EulerCromer,
    VelocityVerlet,
} from "./engine/integrators.js";
import { Camera } from "./render/camera.js";
import { Renderer } from "./render/renderer.js";
import { drawHUD } from "./render/hud.js";
import { PhysicsVisuals } from "./render/physics-visuals.js";
import { PerformanceRecorder } from "./performance.js";
import {
    capturePhysicalState,
    statesAreIdentical,
} from "./replay.js";
import { PointerInput, SlingshotInput } from "./input.js";
import { Body } from "./engine/body.js";
import { Vec2 } from "./engine/vec2.js";
import { drawPointerOverlay } from "./render/pointer-overlay.js";
import { drawLaunchOverlay } from "./render/launch-overlay.js";
import { wirePlaybackExtras, wireKeyboardControls, wirePhysicsSliders, } from "./ui.js";
runCollisionValidation();
import { Gravity, Spring, MouseSpring } from "./engine/forces.js";
import { assertUsableState } from "./part-c-validation.js";

// Check the drag force without changing the displayed simulation.
{
    const testBody = {
        isStatic: false,
        pos: { x: 0, y: 0 },
        vel: { x: 1, y: 0 },
        force: { x: 0, y: 0 },
    };

    const testWorld = { bodies: [testBody] };
    const spring = new MouseSpring(20, 4);

    spring.attach(testBody, { x: 2, y: 0 });
    spring.apply(testWorld);

    const forceCorrect =
        testBody.force.x === 36 && testBody.force.y === 0;

    const energyCorrect = spring.potentialEnergy(testWorld) === 40;

    spring.release();
    testBody.force.x = 0;
    testBody.force.y = 0;
    spring.apply(testWorld);

    console.table({
        "Spring pull includes damping": forceCorrect,
        "Spring potential energy is correct": energyCorrect,
        "Released spring applies no force":
            testBody.force.x === 0 && testBody.force.y === 0,
        "Release preserves velocity": testBody.vel.x === 1,
    });
}

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
const durationSelect = document.getElementById("durationSelect");
const interactionSelect =
    document.getElementById("interactionSelect");

// Fixed drawing coordinates; pixel resolution follows the display.
canvas.logicalWidth = 1000;
canvas.logicalHeight = 850;

function resizeCanvasBuffer() {
    const width = canvas.getBoundingClientRect().width;
    if (width <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(width * dpr));
    const pixelHeight = Math.max(
        1,
        Math.round(width * canvas.logicalHeight / canvas.logicalWidth * dpr)
    );

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
    }
}

const camera = new Camera(40, 500, 530);
const renderer = new Renderer(canvas, camera);
const physicsVisuals = new PhysicsVisuals();

const showVelocity = document.getElementById("showVelocity");
const showForce = document.getElementById("showForce");
const showEnergy = document.getElementById("showEnergy");
const energyPanel = document.getElementById("energyPanel");
const energyCanvas = document.getElementById("energyCanvas");
const energySummary = document.getElementById("energySummary");

showEnergy.addEventListener("change", () => {
    energyPanel.hidden = !showEnergy.checked;
});

energyPanel.hidden = !showEnergy.checked;
const zoomInput = document.getElementById("zoomInput");
const zoomValue = document.getElementById("zoomValue");
const resetViewButton = document.getElementById("resetViewButton");
const arrowScaleInput = document.getElementById("arrowScaleInput");
const arrowScaleValue = document.getElementById("arrowScaleValue");

let viewZoom = 1;
let arrowMagnification = 1;

zoomInput.addEventListener("input", () => {
    const parsed = parseFloat(zoomInput.value);

    viewZoom = Number.isFinite(parsed)
        ? Math.max(0.5, Math.min(3, parsed))
        : 1;

    zoomInput.value = String(viewZoom);
    zoomValue.textContent = viewZoom.toFixed(2);

    // Avoid moving a held target when the coordinate mapping changes.
    pointer.cancelDrag();
    launcher.cancel();
});

resetViewButton.addEventListener("click", () => {
    zoomInput.value = "1";
    zoomInput.dispatchEvent(new Event("input"));
});

arrowScaleInput.addEventListener("input", () => {
    const parsed = parseFloat(arrowScaleInput.value);

    arrowMagnification = Number.isFinite(parsed)
        ? Math.max(0.25, Math.min(10, parsed))
        : 1;

    arrowScaleInput.value = String(arrowMagnification);
    arrowScaleValue.textContent = arrowMagnification.toFixed(2);
});

function applyViewZoom() {
    // Original camera settings for each scene at 1× zoom.
    const baseScale = 40;
    const baseOriginX = sceneSelect.value === "box" ? 100 : 500;
    const baseOriginY = sceneSelect.value === "box" ? 800 : 530;

    const centerX = canvas.logicalWidth / 2;
    const centerY = canvas.logicalHeight / 2;

    // Keep the original view's center fixed while changing scale.
    camera.scale = baseScale * viewZoom;
    camera.originX =
        centerX + (baseOriginX - centerX) * viewZoom;
    camera.originY =
        centerY + (baseOriginY - centerY) * viewZoom;
}

const pointer = new PointerInput(canvas, camera, {
    getWorld: () => world,

    canDrag: () =>
        interactionSelect.value === "drag" &&
        !finished &&
        bonusRunKind === null &&
        (
            sceneSelect.value === "box" ||
            sceneSelect.value === "springs"
        ),

    onDragStart: () => {
        performanceRecorder.stop();

        status.textContent =
            "Dragging with a damped spring. Release to let go. " +
            "Dragging adds external work, so energy need not stay constant.";
    },
});

const launcher = new SlingshotInput(canvas, camera, {
    canLaunch: () =>
        interactionSelect.value === "launch" &&
        sceneSelect.value === "box" &&
        bonusRunKind === null &&
        !finished,

    onLaunch: (position, velocity) => {
        const radius = 0.2;
        const bounds = world.bounds;

        // The entire new ball must fit inside the box.
        if (
            position.x < bounds.xMin + radius ||
            position.x > bounds.xMax - radius ||
            position.y < bounds.yMin + radius ||
            position.y > bounds.yMax - radius
        ) {
            status.textContent =
                "Launch position must be inside the box, away from its walls.";
            return;
        }

        const overlaps = world.bodies.some((body) =>
            Math.hypot(
                position.x - body.pos.x,
                position.y - body.pos.y
            ) < radius + body.radius
        );

        if (overlaps) {
            status.textContent =
                "Choose an empty launch position.";
            return;
        }

        if (world.bodies.length >= 250) {
            status.textContent =
                "250-ball limit reached. Restart to clear launched balls.";
            return;
        }

        world.addBody(new Body({
            m: 1,
            radius,
            pos: new Vec2(position.x, position.y),
            vel: new Vec2(velocity.x, velocity.y),
            name: "Launched ball",
        }));

        performanceRecorder.stop();

        // Adding a body adds energy and momentum.
        initialEnergy = world.totalEnergy();
        initialMomentum = world.totalMomentum();
        maximumRelativeEnergyError = 0;
        maximumMomentumDeviation = 0;

        status.textContent =
            `Ball launched at ${Math.hypot(
                velocity.x, velocity.y
            ).toFixed(2)} m/s. Energy comparison restarted.`;
    },
});

renderer.showTrails = true;

const DT = 1 / 240;
const REPLAY_DURATION = 60;

let runDuration = 60;
let maxSteps = Math.round(runDuration / DT);

function configureDuration(seconds) {
    runDuration = seconds;

    maxSteps = Number.isFinite(seconds)
        ? Math.round(seconds / DT)
        : Infinity;
}

function selectedDuration() {
    if (durationSelect.value === "unlimited") {
        return Infinity;
    }

    const seconds = parseFloat(durationSelect.value);

    return [30, 60, 120].includes(seconds) ? seconds : 60;
}

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
let simulationSpeed = 1;

const stats = {
    fps: 0,
    physicsMs: 0,
    renderMs: 0,
};

function selectedIntegrator() {
    switch (integratorSelect.value) {
        case "verlet":
            return new VelocityVerlet();

        case "euler-cromer":
            return new EulerCromer();

        case "euler":
            return new Euler();

        default:
            throw new Error("Unknown integrator selection.");
    }
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

    configureDuration(REPLAY_DURATION);
    durationSelect.disabled = true;

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
    document.getElementById("gravityInput").value = "0";
    document.getElementById("gravityValue").textContent = "0.00";
    applyPhysicsParameters();

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
    applyPhysicsParameters();

    sceneSelect.disabled = false;
    bodyCountSelect.disabled = false;
    integratorSelect.disabled = false;
    restitutionInput.disabled = false;
    seededRunButton.disabled = false;
    replayButton.disabled = false;
}

// Apply the current slider settings to the active scene's forces.
function applyPhysicsParameters() {
    const gravityInput = document.getElementById("gravityInput");
    const stiffnessInput = document.getElementById("stiffnessInput");

    const gravity = parseFloat(gravityInput.value);
    const stiffness = parseFloat(stiffnessInput.value);

    for (const force of world.forces) {
        if (force instanceof Gravity) {
            force.g = gravity;
        }

        if (force instanceof Spring) {
            force.k = stiffness;
        }
    }

    gravityInput.disabled =
        sceneSelect.value !== "box" || bonusRunKind !== null;

    stiffnessInput.disabled =
        sceneSelect.value !== "springs" || bonusRunKind !== null;
}

// Replace the old world with a fresh copy of the initial scene.
function restartSimulation() {
    pointer.cancelDrag();
    launcher.cancel();

    durationSelect.disabled = false;
    configureDuration(selectedDuration());

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

    applyPhysicsParameters();

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

    status.textContent = Number.isFinite(runDuration)
        ? `${sceneName} running — ${runDuration} simulated seconds.`
        : `${sceneName} running — unlimited duration.`;

}

// Event listeners run their functions when the user uses a control.
restartButton.addEventListener("click", restartSimulation);
interactionSelect.addEventListener("change", () => {
    pointer.cancelDrag();
    launcher.cancel();
});
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

    const parsed = parseFloat(restitutionInput.value);

    world.restitution = Number.isFinite(parsed)
        ? Math.max(0, Math.min(1, parsed))
        : 1;

    restitutionInput.value = String(world.restitution);
    restitutionValue.textContent = world.restitution.toFixed(2);
});

function reportCompletion() {
    finishBonusRun();
    durationSelect.disabled = false;

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

    console.log(
        `Simulation completed: ${runDuration} simulated seconds.`
    );
    console.log("Initial energy:", initialEnergy.toFixed(6), "J");
    console.log("Final energy:", finalEnergy.toFixed(6), "J");
    console.log(
        "Relative energy change:",
        initialEnergy === 0
            ? "N/A: initial energy is zero; use absolute change."
            : ((finalEnergy - initialEnergy) / Math.abs(initialEnergy))
                .toExponential(3)
    );
    console.log("Absolute energy change:", finalEnergy - initialEnergy, "J");

    status.textContent =
        `${runDuration} simulated seconds complete. ` +
        "Click Restart to run again.";

    pointer.cancelDrag();
    launcher.cancel();

    pauseButton.textContent = "Complete";
    pauseButton.disabled = true;
}

// Advance one fixed physics step and update the diagnostics.
function advanceOneStep() {
    if (completedSteps >= maxSteps) return;

    try {
        world.step(DT);
        assertUsableState(world);
    } catch (error) {
        console.error("Simulation stopped and reset:", error);
        restartSimulation();
        performanceRecorder.stop();
        paused = true;
        accumulator = 0;
        previousTimestamp = null;
        pauseButton.textContent = "Resume";
        status.textContent =
            "Run stopped and reset after a numerical failure. " +
            "Choose Velocity Verlet and Restart. Details: " +
            (error instanceof Error ? error.message : String(error));
        return false;
    }

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

    completedSteps++;
    return true;
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
        accumulator += Math.min(elapsed, 0.1) * simulationSpeed;

        while (
            !paused && !finished &&
            accumulator >= DT && completedSteps < maxSteps
        ) {
            if (advanceOneStep() === false) break;
            accumulator -= DT;
        }
    }

    stats.physicsMs = performance.now() - physicsStart;

    if (!finished && completedSteps >= maxSteps) {
        finished = true;
        accumulator = 0;
        reportCompletion();
    }

    const renderStart = performance.now();

    resizeCanvasBuffer();
    applyViewZoom();
    renderer.draw(world);
    physicsVisuals.draw(renderer.ctx, camera, world, {
        velocity: showVelocity.checked,
        force: showForce.checked,
        arrowScale: arrowMagnification,
    });

    if (showEnergy.checked) {
        physicsVisuals.drawSeparateEnergyGraph(
            energyCanvas,
            energySummary
        );
    }

    const downwardGravity = world.forces.reduce(
        (sum, force) =>
            sum + (force instanceof Gravity ? force.g : 0),
        0
    );

    drawLaunchOverlay(
        renderer.ctx,
        camera,
        launcher,
        world,
        downwardGravity
    );

    drawHUD(renderer.ctx, world, initialEnergy, stats);
    drawPointerOverlay(renderer.ctx, camera, pointer);

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

wirePlaybackExtras({
    onStep: () => {
        if (finished || completedSteps >= maxSteps) return;

        // Single step pauses playback and discards leftover frame time.
        performanceRecorder.stop();
        paused = true;
        accumulator = 0;
        previousTimestamp = null;

        const timeBefore = world.time;
        const stepsBefore = completedSteps;

        if (advanceOneStep() === false) return;

        pauseButton.textContent = "Resume";
        status.textContent =
            "Paused — advanced exactly one physics step.";

        console.log(
            `Single step: ${timeBefore.toFixed(9)} s → ` +
            `${world.time.toFixed(9)} s; ` +
            `increase = ${(world.time - timeBefore).toFixed(9)} s; ` +
            `physics steps = ${completedSteps - stepsBefore}`
        );
    },

    onSpeedChange: (speed) => {
        performanceRecorder.stop();
        simulationSpeed = speed;

        // Apply the new speed to future frame intervals.
        accumulator = 0;
        previousTimestamp = null;
    },
});

wirePhysicsSliders({
    onChange: () => {
        performanceRecorder.stop();
        applyPhysicsParameters();

        // Changing a force parameter can change potential energy.
        // Compare subsequent motion with this new starting state.
        initialEnergy = world.totalEnergy();
        initialMomentum = world.totalMomentum();
        maximumRelativeEnergyError = 0;
        maximumMomentumDeviation = 0;

        status.textContent =
            "Physics parameter changed — energy comparison restarted.";
    },
});

wireKeyboardControls();
restartSimulation();
requestAnimationFrame(frame);