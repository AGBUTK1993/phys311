import { createRopeControls } from "./rope-controls.js";
let syncRopeControls = () => { };
import "./checks.js";
import { LIFT_LEVELS } from "./lift-levels.js";

import { runCollisionValidation } from "./validation.js";
import {
    createBoxScene,
    createGravityScene,
    createSpringScene,
    createSuspensionScene,
} from "./scenes.js";
import {
    Euler,
    EulerCromer,
    VelocityVerlet,
} from "./engine/integrators.js";
import { Camera } from "./render/camera.js";
import { Renderer } from "./render/renderer.js";
import { drawHUD, toggleDebug } from "./render/hud.js";
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
import {
    runSuspensionPeriodValidation,
} from "./suspension-validation.js";


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
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const nextWidth = 850 * rect.width / rect.height;

    if (Math.abs(canvas.logicalWidth - nextWidth) > 0.01) {
        pointer.cancelDrag();
        launcher.cancel();
    }

    canvas.logicalHeight = 850;
    canvas.logicalWidth = nextWidth;

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.round(rect.width * dpr));
    const pixelHeight = Math.max(1, Math.round(rect.height * dpr));

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
const showCoordinates = document.getElementById("showCoordinates");

const coordinateOverlay = document.createElement("p");
coordinateOverlay.className = "coordinate-overlay";
coordinateOverlay.hidden = true;

showCoordinates.addEventListener("change", () => {
    coordinateOverlay.hidden = !showCoordinates.checked;
});
const energySummary = document.getElementById("energySummary");
const pointerReadout = document.createElement("p");
pointerReadout.id = "pointerReadout";
pointerReadout.textContent =
    "Pointer: move over or touch the game to inspect coordinates.";

energyPanel.append(pointerReadout);

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
    camera.followCenter = null;
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

let cameraWorld = null;

function applyViewZoom(elapsed = 0) {
    const width = canvas.logicalWidth;
    const height = canvas.logicalHeight;

    if (sceneSelect.value === "suspension" && world?.anchor) {
        const area = canvas.closest(".game-area");
        const expanded =
            area?.classList.contains("is-expanded") ||
            document.fullscreenElement === area;

        const touchLayout =
            area?.classList.contains("touch-layout");

        const screenScale =
            height / canvas.getBoundingClientRect().height;

        const bannerHeight = area
            ?.querySelector(".game-banner-size")
            ?.getBoundingClientRect().height || 0;

        const topPadding = expanded
            ? (bannerHeight + 12) * screenScale
            : 100;

        const mobileView = window.matchMedia(
            "(pointer: coarse)"
        ).matches;

        const portrait = window.matchMedia(
            "(orientation: portrait)"
        ).matches;

        const bottomSpace = mobileView && world.verticalEnabled
            ? (portrait ? 184 : 144)
            : (mobileView && !portrait ? 88 : 144);

        const bottomPadding = expanded
            ? Math.min(height * 0.38, bottomSpace * screenScale)
            : (touchLayout ? 30 : 210);

        const usableHeight = Math.max(
            80, height - topPadding - bottomPadding
        );

        // Show less vertical world space on phones, making objects larger.
        // Desktop keeps its existing eight-metre default.
        const visibleWorldHeight = mobileView ? 6 : 8;
        camera.scale = usableHeight / visibleWorldHeight * viewZoom;

        camera.follow(
            {
                x: world.load.pos.x,
                // Favor the artifact while keeping room for the support.
                y: 0.6 * world.load.pos.y +
                    0.4 * world.anchor.pos.y,
            },
            world.cameraBounds,
            width,
            usableHeight,
            elapsed,
            cameraWorld !== world
        );

        camera.originY += topPadding;
        cameraWorld = world;
        return;
    }

    // Fit the other simulations to their original reference view.
    cameraWorld = null;
    camera.followCenter = null;

    const fit = Math.min(width / 1000, height / 850);
    const baseOriginX = sceneSelect.value === "box" ? 100 : 500;
    const baseOriginY = sceneSelect.value === "box" ? 800 : 530;

    camera.scale = 40 * fit * viewZoom;
    camera.originX =
        width / 2 + (baseOriginX - 500) * fit * viewZoom;
    camera.originY =
        height / 2 + (baseOriginY - 425) * fit * viewZoom;
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

let selectedLiftLevel = 0;
const completedLiftLevels = new Set();

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
    } else if (scene === "suspension") {
        world = createSuspensionScene(
            conservativeModeInput.checked ? 0 : selectedLiftLevel
        );
        world.conservativeMode = conservativeModeInput.checked;

        if (world.conservativeMode) {
            world.dampingRate = 0;
            world.anchor.vel.x = 0;
            world.anchor.vel.y = 0;
            world.supportTarget = world.anchor.pos.x;
            world.supportAcceleration = 0;
            world.updateBodyState();
        }

        camera.scale = 40;
        camera.originX = 500;
        camera.originY = 530;

        renderer.showTrails = false;
        restitutionInput.disabled = true;

        // This scene uses angular Velocity Verlet.
        integratorSelect.value = "verlet";
        integratorSelect.disabled = true;
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
    syncLiftLevelControls();
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

    if (paused) {
        openGameMenu();
    }
});

integratorSelect.addEventListener("change", () => {
    performanceRecorder.stop();

    if (sceneSelect.value === "suspension") {
        integratorSelect.value = "verlet";
        return;
    }

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

        // Stop immediately when the rope model becomes invalid.
        if (world.stoppedForSlack) {
            paused = true;
            finished = true;
            accumulator = 0;
            pauseButton.disabled = true;
            status.textContent =
                "The rope would go slack. Click Restart to try again.";
            return false;
        }

        // Count delivery time in physics steps, not rendered frames.
        if (world.ropeState === "broken") {
            status.textContent =
                "Rope broken. Restart this chamber to try again.";

            // Show the release and fall before ending the attempt.
            if (world.time - world.breakTime >= 1.5) {
                paused = true;
                finished = true;
                accumulator = 0;
                pauseButton.disabled = true;
                return false;
            }
        }

        if (
            world.delivery &&
            !world.conservativeMode &&
            world.ropeState !== "broken"
        ) {
            world.delivery.update(world.load, DT);

            if (world.delivery.won) {
                completedLiftLevels.add(world.liftLevel.id);
                syncLiftLevelControls();
                paused = true;
                finished = true;
                pauseButton.textContent = "Delivered";
                pauseButton.disabled = true;

                status.textContent =
                    "CHAMBER COMPLETE! The artifact stayed inside the " +
                    "zone below 0.2 m/s for one simulated second. " +
                    "Choose Next Chamber or Select Chamber.";
            }
        }
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
    applyViewZoom(elapsed);
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

    if (showEnergy.checked || showCoordinates.checked) {
        const position = pointer.position;

        const pointerText = position
            ? `Pointer: x = ${position.x.toFixed(3)} m, ` +
            `y = ${position.y.toFixed(3)} m`
            : "Pointer: move over or touch the game to inspect coordinates.";

        for (const readout of [pointerReadout, coordinateOverlay]) {
            if (readout.textContent !== pointerText) {
                readout.textContent = pointerText;
            }
        }
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

    syncChamberPresentation();
    syncRopeControls();

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

// Suspension controls: native range input supports mouse, touch,
// and keyboard arrows without adding global keyboard shortcuts.
const liftLevelControls = document.createElement("section");
liftLevelControls.className = "lift-level-controls";

const liftLevelLabel = document.createElement("label");
liftLevelLabel.htmlFor = "liftLevelSelect";
liftLevelLabel.textContent =
    "Lift chamber (changing restarts the scene): ";

const liftLevelSelect = document.createElement("select");
liftLevelSelect.id = "liftLevelSelect";

for (const [index, level] of LIFT_LEVELS.entries()) {
    liftLevelSelect.add(new Option(level.name, String(index)));
}

const liftLevelHint = document.createElement("p");

const nextChamberButton = document.createElement("button");
nextChamberButton.type = "button";
nextChamberButton.textContent = "Next chamber";

liftLevelControls.id = "liftChamberChoices";
liftLevelControls.hidden = true;
liftLevelControls.append(
    liftLevelLabel,
    liftLevelSelect,
    liftLevelHint
);

const menuChamberSelect =
    document.getElementById("menuChamberSelect");

menuChamberSelect.setAttribute(
    "aria-controls", liftLevelControls.id
);
menuChamberSelect.setAttribute("aria-expanded", "false");

const chamberBadge = document.createElement("p");
chamberBadge.className = "chamber-badge";
chamberBadge.setAttribute("aria-live", "polite");

const completionPanel = document.createElement("section");
completionPanel.className = "chamber-complete-panel";
completionPanel.hidden = true;
completionPanel.setAttribute("role", "region");
completionPanel.setAttribute(
    "aria-labelledby", "chamberCompleteHeading"
);
completionPanel.innerHTML =
    '<h2 id="chamberCompleteHeading">Chamber Complete</h2>';

const completionMessage = document.createElement("p");

const completionActions = document.createElement("div");
completionActions.className = "chamber-complete-actions";

const selectChamberButton = document.createElement("button");
selectChamberButton.type = "button";
selectChamberButton.textContent = "Select Chamber";

completionActions.append(
    selectChamberButton,
    nextChamberButton
);
completionPanel.append(completionMessage, completionActions);

function showChamberSelection() {
    if (sceneSelect.value !== "suspension") return;

    openGameMenu();
    completionPanel.hidden = true;
    liftLevelControls.hidden = false;
    menuChamberSelect.setAttribute("aria-expanded", "true");

    liftLevelSelect.focus({ preventScroll: true });
    liftLevelControls.scrollIntoView({ block: "nearest" });
}

menuChamberSelect.addEventListener(
    "click", showChamberSelection
);
selectChamberButton.addEventListener(
    "click", showChamberSelection
);

let lastCompletedWorld = null;

function syncChamberPresentation() {
    const isLift =
        sceneSelect.value === "suspension" &&
        !!world?.liftLevel;

    chamberBadge.hidden = !isLift;
    menuChamberSelect.hidden = !isLift;

    completionPanel.hidden =
        !isLift ||
        world.conservativeMode ||
        !world.delivery.won ||
        gameMenu.open;

    if (!isLift) return;

    const label =
        "Chamber " + world.liftLevel.name +
        (world.conservativeMode ? " · Physics test" : "");

    if (chamberBadge.textContent !== label) {
        chamberBadge.textContent = label;
    }

    if (!completionPanel.hidden) {
        const message = selectedLiftLevel < LIFT_LEVELS.length - 1
            ? "Artifact secured. Continue or choose another chamber."
            : "Final chamber complete. Choose a chamber to replay.";

        if (completionMessage.textContent !== message) {
            completionMessage.textContent = message;
        }

        if (lastCompletedWorld !== world) {
            lastCompletedWorld = world;

            requestAnimationFrame(() => {
                if (!completionPanel.hidden) {
                    (nextChamberButton.disabled
                        ? selectChamberButton
                        : nextChamberButton).focus();
                }
            });
        }
    }
}

function syncLiftLevelControls() {
    const active = sceneSelect.value === "suspension";
    if (!active) liftLevelControls.hidden = true;

    if (!active || !world) return;

    liftLevelSelect.value = String(selectedLiftLevel);
    liftLevelSelect.disabled = world.conservativeMode;

    for (const [index, level] of LIFT_LEVELS.entries()) {
        liftLevelSelect.options[index].textContent =
            level.name +
            (completedLiftLevels.has(level.id) ? " ✓" : "");
    }

    liftLevelHint.textContent = world.conservativeMode
        ? "Conservative testing uses the original chamber with no damping."
        : world.liftLevel.hint;

    nextChamberButton.disabled =
        world.conservativeMode ||
        !world.delivery.won ||
        selectedLiftLevel >= LIFT_LEVELS.length - 1;

    nextChamberButton.textContent = "Next Chamber";
}

liftLevelSelect.addEventListener("change", () => {
    selectedLiftLevel = Number(liftLevelSelect.value);
    restartSimulation();
    keepMenuPaused();
});

nextChamberButton.addEventListener("click", () => {
    if (nextChamberButton.disabled) return;

    selectedLiftLevel += 1;
    gameMenu.close();
    restartSimulation();
    canvas.focus({ preventScroll: true });
});

const suspensionControls = document.createElement("section");
suspensionControls.hidden = true;

const conservativeModeLabel = document.createElement("label");

const conservativeModeInput = document.createElement("input");
conservativeModeInput.type = "checkbox";
conservativeModeInput.id = "conservativeModeInput";

conservativeModeLabel.append(
    conservativeModeInput,
    document.createTextNode(
        " Conservative mode — fixed support, no damping; restarts scene"
    )
);

conservativeModeInput.addEventListener("change", () => {
    if (sceneSelect.value === "suspension") {
        restartSimulation();
    }
});

const supportLabel = document.createElement("label");
supportLabel.htmlFor = "supportTargetInput";
supportLabel.textContent = "Support target: ";

const supportTargetInput = document.createElement("input");
supportTargetInput.type = "range";
supportTargetInput.id = "supportTargetInput";
supportTargetInput.min = "-3";
supportTargetInput.max = "3";
supportTargetInput.step = "0.1";
supportTargetInput.value = "0";

const supportTargetValue = document.createElement("output");
supportTargetValue.htmlFor = supportTargetInput.id;
supportTargetValue.textContent = "0.0 m";

const suspensionInstructions = document.createElement("p");
suspensionInstructions.textContent =
    "Guide the entire load into the green delivery zone below " +
    "0.2 m/s for one continuous simulated second. " +
    "Tab to the support slider and use arrow keys, or use the mouse. " +
    "The motor can add or remove energy; suspension damping removes energy. " +
    "Conservative mode fixes the support, disables damping, and " +
    "disables delivery completion so you can check energy conservation.";

const suspensionReadout = document.createElement("p");
suspensionReadout.setAttribute("aria-live", "off");
supportLabel.append(supportTargetInput, supportTargetValue);
suspensionControls.append(
    conservativeModeLabel,
    document.createElement("br"),
    supportLabel,
    suspensionInstructions,
    suspensionReadout
);
canvas.before(suspensionControls);

supportTargetInput.addEventListener("input", () => {
    if (
        sceneSelect.value !== "suspension" ||
        !world ||
        world.conservativeMode ||
        finished ||
        world.stoppedForSlack
    ) return;

    world.supportTarget = Number(supportTargetInput.value);
    supportTargetValue.textContent =
        world.supportTarget.toFixed(1) + " m";
});

// Refresh the readout and recognize new worlds created by Restart.
let lastSuspensionWorld = null;

setInterval(() => {
    const isSuspension = sceneSelect.value === "suspension";
    suspensionControls.hidden = !isSuspension;

    if (!isSuspension || !world) return;

    if (world !== lastSuspensionWorld) {
        lastSuspensionWorld = world;
        supportTargetInput.value = String(world.supportTarget);
        supportTargetValue.textContent =
            world.supportTarget.toFixed(1) + " m";
    }

    supportTargetInput.disabled =
        world.conservativeMode || finished || world.stoppedForSlack;

    const goal = world.delivery;
    const loadSpeed = Math.hypot(world.load.vel.x, world.load.vel.y);

    suspensionReadout.textContent =
        `Support x: ${world.anchor.pos.x.toFixed(2)} m | ` +
        `Height: ${world.anchor.pos.y.toFixed(2)} m | ` +
        `Tension: ${world.tension.toFixed(2)} N | ` +
        `Load speed: ${loadSpeed.toFixed(3)} m/s | `;

    if (world.conservativeMode) {
        suspensionReadout.textContent +=
            "Conservative mode: support fixed, damping off, delivery disabled.";
    } else {
        suspensionReadout.textContent +=
            `Delivery hold: ${goal.heldTime.toFixed(2)} / 1.00 s`;

        if (goal.won) {
            suspensionReadout.textContent += " — Delivery successful!";
        }
    }

    if (world.stoppedForSlack) {
        paused = true;
        accumulator = 0;
        pauseButton.disabled = true;
        suspensionReadout.textContent +=
            " — Stopped: the rope would go slack. Click Restart.";
        status.textContent =
            "Taut-rope model limit reached. Click Restart.";
    }
}, 100);

// Game menu: uses the existing simulation state.
const menuButton = document.getElementById("menuButton");
const gameMenu = document.getElementById("gameMenu");
const menuResume = document.getElementById("menuResume");
const menuRestart = document.getElementById("menuRestart");
const menuClose = document.getElementById("menuClose");
const gameMenuStatus = document.getElementById("gameMenuStatus");

function openGameMenu() {
    if (gameMenu.open) return;

    // Release active interactions before opening the menu.
    pointer.cancelDrag();
    launcher.cancel();
    performanceRecorder.stop();

    paused = true;
    accumulator = 0;
    previousTimestamp = null;

    if (!finished) {
        pauseButton.textContent = "Resume";
    }

    menuResume.disabled = finished;

    gameMenuStatus.textContent = finished
        ? "This run has ended. Restart to play again."
        : "Game paused.";

    gameMenu.showModal();
}

function closeGameMenu(resumePlay = false) {
    if (!gameMenu.open) return;

    // Only an explicit Resume action restarts motion.
    paused = finished || !resumePlay;
    accumulator = 0;
    previousTimestamp = null;

    if (!finished) {
        pauseButton.textContent = paused ? "Resume" : "Pause";
        status.textContent = paused
            ? "Paused — inspect the scene, use Single step, " +
            "or select Resume to continue."
            : "Simulation running.";
    }

    gameMenu.close();
    menuButton.focus();
}

menuButton.addEventListener("click", openGameMenu);

menuResume.addEventListener("click", () => {
    if (!finished) closeGameMenu(true);
});

menuClose.addEventListener("click", () => {
    closeGameMenu();
});

menuRestart.addEventListener("click", () => {
    gameMenu.close();
    restartSimulation();
    menuButton.focus();
});

// Escape closes the menu while leaving the scene paused.
gameMenu.addEventListener("cancel", event => {
    event.preventDefault();
    closeGameMenu();
});

// Keep menu keystrokes away from gameplay keyboard handlers.
// Native Tab, Enter, Space, and Escape behavior still works.
gameMenu.addEventListener("keydown", event => {
    event.stopPropagation();
});

// Settings may restart a scene, but an open menu must keep it paused.
function keepMenuPaused() {
    if (!gameMenu.open) return;

    paused = true;
    accumulator = 0;
    previousTimestamp = null;

    menuResume.disabled = finished;

    if (!finished) {
        pauseButton.textContent = "Resume";
        gameMenuStatus.textContent =
            "Game paused. Select Resume when ready.";
    } else {
        gameMenuStatus.textContent =
            "This run has ended. Restart to play again.";
    }
}

for (const eventName of ["input", "change", "click"]) {
    gameMenu.addEventListener(eventName, keepMenuPaused);
}

// Move existing controls after both UI modules finish initialization.
window.addEventListener("DOMContentLoaded", () => {
    const settingsContent =
        document.getElementById("menuSettingsContent");

    const toolbar = document.createElement("div");
    toolbar.className = "game-toolbar";
    toolbar.setAttribute("role", "group");
    toolbar.setAttribute("aria-label", "Game controls");

    // Keep the canvas and its HTML controls in one positioned container.
    const gameArea = document.createElement("div");
    gameArea.className = "game-area";

    canvas.before(gameArea);
    gameArea.append(toolbar, canvas);
    // Fullscreen includes HTML controls and the settings dialog.
    gameArea.append(gameMenu, coordinateOverlay);
    gameArea.append(chamberBadge, completionPanel);

    gameMenu.addEventListener("close", () => {
        liftLevelControls.hidden = true;
        menuChamberSelect.setAttribute("aria-expanded", "false");
    });

    gameMenu.addEventListener("click", event => {
        if (event.target.closest?.("#debugToggleButton")) {
            closeGameMenu(false);
            focusGame();
        }
    });

    const bannerSize = document.createElement("div");
    bannerSize.className = "game-banner-size";
    bannerSize.setAttribute("aria-hidden", "true");
    gameArea.append(bannerSize);

    const fullscreenButton = document.createElement("button");
    fullscreenButton.type = "button";
    fullscreenButton.className = "game-fullscreen-button";
    fullscreenButton.textContent = "Fullscreen";
    fullscreenButton.setAttribute("aria-label", "Enter fullscreen");
    fullscreenButton.setAttribute("aria-pressed", "false");
    gameArea.append(fullscreenButton);

    const touchLayout = window.matchMedia(
        "(pointer: coarse), (max-width: 700px)"
    );

    function syncTouchLayout() {
        gameArea.classList.toggle("touch-layout", touchLayout.matches);
        clearSupportKeys();
    }

    touchLayout.addEventListener("change", syncTouchLayout);

    const viewControls = document.createElement("div");
    viewControls.className = "game-view-controls";
    viewControls.setAttribute("role", "group");
    viewControls.setAttribute("aria-label", "View controls");

    function makeViewButton(text, label, action) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "touch-view-button";
        button.textContent = text;
        button.setAttribute("aria-label", label);
        button.addEventListener("click", () => {
            clearSupportKeys();
            action();
            if (!gameMenu.open) focusGame();
        });
        return button;
    }

    function changeTouchZoom(direction) {
        const next = Number(zoomInput.value) +
            direction * (Number(zoomInput.step) || 0.1);

        zoomInput.value = String(Math.max(
            Number(zoomInput.min),
            Math.min(Number(zoomInput.max), next)
        ));
        zoomInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const zoomOut = makeViewButton(
        "−", "Zoom out", () => changeTouchZoom(-1)
    );
    const zoomIn = makeViewButton(
        "+", "Zoom in", () => changeTouchZoom(1)
    );

    viewControls.append(
        makeViewButton("Reset view", "Reset zoom", () => {
            resetViewButton.click();
        }),
        fullscreenButton
    );

    gameArea.append(viewControls);

    const supportsFullscreen =
        document.fullscreenEnabled &&
        typeof gameArea.requestFullscreen === "function";

    let expandedView = false;
    let previousBodyOverflow = "";

    function setExpandedView(expanded) {
        expandedView = expanded;

        if (expanded) {
            previousBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = previousBodyOverflow;
        }

        gameArea.classList.toggle("is-expanded", expanded);
        fullscreenButton.textContent = expanded
            ? "Exit expanded"
            : supportsFullscreen ? "Fullscreen" : "Expand";

        fullscreenButton.setAttribute(
            "aria-label",
            expanded ? "Exit expanded game view"
                : supportsFullscreen ? "Enter fullscreen"
                    : "Expand game view"
        );
        fullscreenButton.setAttribute("aria-pressed", String(expanded));

        clearSupportKeys();
        pointer.cancelDrag();
        launcher.cancel();
    }

    fullscreenButton.textContent =
        supportsFullscreen ? "Fullscreen" : "Expand";
    fullscreenButton.setAttribute(
        "aria-label",
        supportsFullscreen ? "Enter fullscreen" : "Expand game view"
    );

    fullscreenButton.addEventListener("click", async () => {
        clearSupportKeys();

        if (expandedView || !supportsFullscreen) {
            setExpandedView(!expandedView);
            if (!gameMenu.open) focusGame();
            return;
        }

        try {
            if (document.fullscreenElement === gameArea) {
                await document.exitFullscreen();
            } else {
                await gameArea.requestFullscreen({
                    keyboardLock: "browser",
                });

                // Compatibility with browsers exposing Keyboard.lock().
                if (
                    document.fullscreenElement === gameArea &&
                    navigator.keyboard?.lock
                ) {
                    try {
                        await navigator.keyboard.lock(["Escape"]);

                        // Fullscreen may have ended while permission
                        // was being handled.
                        if (document.fullscreenElement !== gameArea) {
                            navigator.keyboard.unlock();
                        }
                    } catch (error) {
                        setExpandedView(true);
                        status.textContent =
                            "Expanded game view. Use Exit expanded to return.";
                        console.info("Using expanded view:", error);
                    }
                }
            }
        } catch (error) {
            status.textContent =
                "Fullscreen could not start. You can continue playing here.";
            console.warn("Fullscreen request failed:", error);
        }

        if (!gameMenu.open) focusGame();
    });

    document.addEventListener("fullscreenchange", () => {
        const isFullscreen =
            document.fullscreenElement === gameArea;
        if (!isFullscreen) {
            navigator.keyboard?.unlock?.();
        }

        fullscreenButton.textContent =
            isFullscreen ? "Exit fullscreen" : "Fullscreen";

        fullscreenButton.setAttribute(
            "aria-label",
            isFullscreen ? "Exit fullscreen" : "Enter fullscreen"
        );

        fullscreenButton.setAttribute(
            "aria-pressed",
            String(isFullscreen)
        );

        clearSupportKeys();
        pointer.cancelDrag();
        launcher.cancel();

        if (!gameMenu.open) focusGame();
    });

    // Bottom-center support slider and shortcut strip.
    const bottomControls = document.createElement("div");
    bottomControls.className = "game-bottom-controls";
    bottomControls.id = "gameSliderPanel";

    const shortcuts = document.createElement("div");
    shortcuts.className = "game-shortcuts";
    shortcuts.setAttribute("aria-label", "Keyboard shortcuts");

    shortcuts.innerHTML = `
        <span>
            <kbd>A</kbd><kbd>D</kbd>
            /
            <kbd>←</kbd><kbd>→</kbd>
            Move
        </span>
        <span><kbd>Space</kbd> Pause</span>
        <span><kbd>M</kbd> Menu</span>
                <span><kbd>C</kbd> Controls</span>
        <span><kbd>G</kbd> Graph</span>
        <span><kbd>Esc</kbd> Close / exit</span>
    `;

    supportLabel.classList.add("game-support-control");
    bottomControls.append(shortcuts, supportLabel);
    gameArea.append(bottomControls);

    syncRopeControls = createRopeControls({
        getWorld: () => world,

        canAdjust: () =>
            sceneSelect.value === "suspension" &&
            !world.conservativeMode &&
            !finished,

        bottom: bottomControls,
        settings: settingsContent,
    });

    // Keep portrait touch buttons above the actual slider-panel height.
    const sliderPanelObserver = new ResizeObserver(() => {
        gameArea.style.setProperty(
            "--slider-panel-height",
            `${bottomControls.getBoundingClientRect().height}px`
        );
    });

    sliderPanelObserver.observe(bottomControls);

    function syncGameOverlay() {
        bottomControls.hidden = sceneSelect.value !== "suspension";
    }

    sceneSelect.addEventListener("change", syncGameOverlay);
    syncGameOverlay();
    // Keyboard control belongs to the canvas. Settings retain normal input.
    const heldSupportKeys = new Set();
    const horizontalKeys = new Set([
        "a", "d", "ArrowLeft", "ArrowRight",
    ]);
    const reservedVerticalKeys = new Set([
        "w", "s", "ArrowUp", "ArrowDown",
    ]);

    function clearSupportKeys() {
        heldSupportKeys.clear();
    }

    const touchMovement = document.createElement("div");
    touchMovement.className = "game-touch-movement";
    touchMovement.setAttribute("role", "group");
    touchMovement.setAttribute("aria-label", "Move support");

    function canUseTouchMovement() {
        return sceneSelect.value === "suspension" &&
            world &&
            !paused &&
            !finished &&
            !gameMenu.open &&
            !world.conservativeMode &&
            !world.stoppedForSlack;
    }

    function makeMoveButton(text, direction, token, vertical = false) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.setAttribute(
            "aria-label",
            direction < 0 ? "Move support left" : "Move support right"
        );

        let activePointer = null;

        button.addEventListener("pointerdown", event => {
            if (event.button !== 0 || activePointer !== null) return;
            event.preventDefault();
            focusGame();

            if (
                !canUseTouchMovement() ||
                (vertical && !world.verticalEnabled)
            ) return;

            activePointer = event.pointerId;
            button.setPointerCapture(event.pointerId);
            heldSupportKeys.add(token);
        });

        function release(event) {
            if (event.pointerId !== activePointer) return;
            heldSupportKeys.delete(token);
            activePointer = null;
        }

        button.addEventListener("pointerup", release);
        button.addEventListener("pointercancel", release);
        button.addEventListener("lostpointercapture", release);
        button.addEventListener("contextmenu", event => {
            event.preventDefault();
        });

        // Keyboard/assistive activation makes one small movement.
        button.addEventListener("click", event => {
            if (event.detail !== 0 || !canUseTouchMovement()) return;
            if (vertical) {
                if (!world.verticalEnabled) return;

                world.supportHeightTarget = Math.max(
                    world.supportHeightMin,
                    Math.min(
                        world.supportHeightMax,
                        world.supportHeightTarget + direction * 0.1
                    )
                );
                return;
            }

            supportTargetInput.value = String(Math.max(
                Number(supportTargetInput.min),
                Math.min(
                    Number(supportTargetInput.max),
                    world.supportTarget + direction * 0.1
                )
            ));
            supportTargetInput.dispatchEvent(
                new Event("input", { bubbles: true })
            );
        });

        return button;
    }

    const leftMove = makeMoveButton("◀", -1, "touch-left");
    const rightMove = makeMoveButton("▶", 1, "touch-right");

    leftMove.setAttribute("aria-label", "Move support left");
    rightMove.setAttribute("aria-label", "Move support right");
    leftMove.classList.add("move-support");
    rightMove.classList.add("move-support");

    const leftCorner = document.createElement("div");
    const rightCorner = document.createElement("div");

    leftCorner.className = "game-corner game-corner-left";
    rightCorner.className = "game-corner game-corner-right";

    const downMove = makeMoveButton(
        "▼", -1, "touch-down", true
    );
    const upMove = makeMoveButton(
        "▲", 1, "touch-up", true
    );

    downMove.setAttribute("aria-label", "Lower support");
    upMove.setAttribute("aria-label", "Raise support");

    downMove.classList.add("move-support", "vertical-move");
    upMove.classList.add("move-support", "vertical-move");

    downMove.hidden = upMove.hidden = true;

    leftCorner.append(leftMove, zoomOut, downMove);
    rightCorner.append(zoomIn, rightMove, upMove);

    touchMovement.className = "game-corner-controls";
    touchMovement.setAttribute("aria-label", "Movement and zoom");
    touchMovement.append(leftCorner, rightCorner);
    gameArea.append(touchMovement);

    function syncMovementButtons() {
        const isLift = sceneSelect.value === "suspension";

        leftMove.hidden = rightMove.hidden = !isLift;

        downMove.hidden = upMove.hidden =
            !isLift || !world?.verticalEnabled;

        downMove.disabled = upMove.disabled =
            !canUseTouchMovement();
    }

    sceneSelect.addEventListener("change", syncMovementButtons);
    syncMovementButtons();
    syncTouchLayout();

    function focusGame() {
        canvas.focus({ preventScroll: true });
    }

    const controlsPanel = document.createElement("section");
    controlsPanel.id = "controlsPanel";
    controlsPanel.className = "game-info-panel";
    controlsPanel.hidden = true;
    controlsPanel.setAttribute("aria-labelledby", "controlsHeading");

    const controlsText = `
        <dl class="controls-list">
            <dt>A / D or ← / →</dt>
            <dd>Move the support; touch buttons and slider also work.</dd>

            <dt>W / S or ↑ / ↓</dt>
            <dd>Raise/lower the support in lifting chambers.
                On touchscreens use ▲/▼.
                The rope stays the same length.</dd>

            <dt>Space</dt>
            <dd>Pause or resume.</dd>

            <dt>R</dt>
            <dd>Restart this scene.</dd>

            <dt>U / J or numpad 8 / 2</dt>
<dd>
    Hold U or numpad 8 to shorten the rope.
    Hold J or numpad 2 to lengthen it.
    The rope-length slider also supports mouse, touch,
    and keyboard arrows when focused.
</dd>

            <dt>F</dt>
            <dd>Toggle fullscreen or expanded view.</dd>

            <dt>+ / −</dt>
            <dd>Zoom in or out.</dd>

            <dt>M</dt>
            <dd>Open or close the menu.</dd>

            <dt>C</dt>
            <dd>Show or hide these controls.</dd>

            <dt>G</dt>
            <dd>Show or hide the energy graph.</dd>
                        <dt>B</dt>
            <dd>Show or hide the debug panel.</dd>

            <dt>Esc</dt>
            <dd>Close the menu or an information panel without resuming;
                otherwise exit fullscreen/expanded view.</dd>
        </dl>
        <p>Click the game to use shortcuts.
           Settings retain normal keyboard input.</p>
    `;

    controlsPanel.innerHTML =
        '<h2 id="controlsHeading">Controls</h2>' + controlsText;

    energyPanel.classList.add("game-info-panel");
    gameArea.append(controlsPanel, energyPanel);

    function setGraphVisible(visible) {
        showEnergy.checked = visible;
        showEnergy.dispatchEvent(
            new Event("change", { bubbles: true })
        );
    }

    function toggleControls() {
        controlsPanel.hidden = !controlsPanel.hidden;

        if (!controlsPanel.hidden) setGraphVisible(false);
        focusGame();
    }

    function toggleGraph() {
        controlsPanel.hidden = true;
        setGraphVisible(!showEnergy.checked);
        focusGame();
    }

    showEnergy.addEventListener("change", () => {
        if (showEnergy.checked) controlsPanel.hidden = true;
    });

    for (const [panel, close] of [
        [controlsPanel, () => { controlsPanel.hidden = true; }],
        [energyPanel, () => setGraphVisible(false)],
    ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "panel-close";
        button.textContent = "Close";

        button.addEventListener("click", () => {
            close();
            focusGame();
        });

        panel.prepend(button);
    }

    const menuControls = document.createElement("details");
    menuControls.innerHTML =
        "<summary>Controls and shortcuts</summary>" + controlsText;

    const panelButtons = document.createElement("div");
    panelButtons.className = "menu-actions";

    for (const [label, action] of [
        ["Show controls", toggleControls],
        ["Show / hide graph", toggleGraph],
    ]) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;

        button.addEventListener("click", () => {
            closeGameMenu(false);
            action();
        });

        panelButtons.append(button);
    }

    document.getElementById("menuClose").before(
        menuControls, panelButtons
    );

    // Handle menu shortcuts before the canvas and dialog handlers.
    window.addEventListener("keydown", event => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const key = event.key.toLowerCase();
        const target = event.target;

        const inGame =
            gameArea.contains(document.activeElement) ||
            gameMenu.open ||
            document.fullscreenElement === gameArea;

        if (!inGame) return;

        // Escape works from settings too; letter shortcuts must not
        // interfere with typing or native form-control behavior.
        const editingControl =
            target instanceof HTMLElement &&
            (
                target.closest(
                    "input, select, textarea, button, summary"
                ) ||
                target.isContentEditable
            );

        const debugFromButton =
            key === "b" &&
            target instanceof HTMLElement &&
            !target.isContentEditable &&
            !!target.closest("button, summary");

        if (
            key !== "escape" &&
            editingControl &&
            !debugFromButton
        ) return;
        if (!["f", "m", "b", "c", "g", "escape"].includes(key)) return;

        event.preventDefault();
        event.stopImmediatePropagation();

        // Holding a toggle key must not repeatedly toggle its action.
        if (event.repeat) return;

        clearSupportKeys();

        if (key === "c" || key === "g") {
            if (gameMenu.open) closeGameMenu(false);

            if (key === "c") toggleControls();
            else toggleGraph();

            return;
        }

        if (
            key === "escape" &&
            !gameMenu.open &&
            (!controlsPanel.hidden || !energyPanel.hidden)
        ) {
            controlsPanel.hidden = true;
            setGraphVisible(false);
            focusGame();
            return;
        }

        if (key === "f") {
            fullscreenButton.click();
            return;
        }

        if (key === "m") {
            if (gameMenu.open) {
                closeGameMenu(false);
            } else {
                openGameMenu();
            }
            return;
        }

        if (key === "b") {
            toggleDebug();

            if (gameMenu.open) closeGameMenu(false);
            focusGame();
            return;
        }

        // Escape closes the menu first, without resuming.
        if (gameMenu.open) {
            closeGameMenu(false);
            return;
        }

        if (expandedView) {
            setExpandedView(false);
            focusGame();
            return;
        }

        // With no menu open, Escape exits fullscreen.
        if (document.fullscreenElement === gameArea) {
            document.exitFullscreen().catch(error => {
                console.warn("Could not exit fullscreen:", error);
            });
        }
    }, { capture: true });

    function movementKey(event) {
        // Physical numpad keys remain identifiable with Num Lock off.
        if (
            event.code === "Numpad8" ||
            event.code === "Numpad2"
        ) {
            return event.code;
        }

        return event.key.length === 1
            ? event.key.toLowerCase()
            : event.key;
    }

    // A finer slider step keeps its displayed position smooth.
    supportTargetInput.step = "0.01";

    canvas.addEventListener("pointerdown", focusGame);

    canvas.addEventListener("keydown", event => {
        if (event.ctrlKey || event.metaKey || event.altKey) return;

        const key = movementKey(event);

        if (sceneSelect.value !== "suspension") return;

        const verticalKey = reservedVerticalKeys.has(key);

        const ropeKey = [
            "u",
            "j",
            "Numpad8",
            "Numpad2",
        ].includes(key);

        if (
            !horizontalKeys.has(key) &&
            !verticalKey &&
            !ropeKey
        ) return;

        if (verticalKey && !world?.verticalEnabled) {
            event.preventDefault();
            event.stopImmediatePropagation();
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();

        if (
            gameMenu.open ||
            paused ||
            finished ||
            !world ||
            world.conservativeMode ||
            world.stoppedForSlack
        ) return;

        // Ignore auto-repeat after a focus change or pause.
        if (!event.repeat) heldSupportKeys.add(key);
    }, { capture: true });

    window.addEventListener("keyup", event => {
        const key = movementKey(event);

        heldSupportKeys.delete(key);
    }, { capture: true });

    canvas.addEventListener("blur", clearSupportKeys);
    window.addEventListener("blur", clearSupportKeys);
    window.addEventListener("pagehide", clearSupportKeys);
    document.addEventListener("visibilitychange", clearSupportKeys);
    sceneSelect.addEventListener("change", clearSupportKeys);

    // Clear movement as soon as the menu opens or closes.
    const menuObserver = new MutationObserver(clearSupportKeys);
    menuObserver.observe(gameMenu, {
        attributes: true,
        attributeFilter: ["open"],
    });

    // Playback actions clear held movement. Closing the menu returns
    // keyboard focus to the game; settings controls keep their own focus.
    for (const id of [
        "menuButton",
        "pauseButton",
        "restartButton",
        "menuResume",
        "menuRestart",
        "menuClose",
    ]) {
        document.getElementById(id).addEventListener("click", () => {
            clearSupportKeys();

            if (!gameMenu.open) focusGame();
        });
    }

    gameMenu.addEventListener("close", () => {
        clearSupportKeys();
        focusGame();
    });

    let previousSupportTime = null;
    let keyboardWorld = world;
    const supportKeyboardSpeed = 1.5; // Target movement in meters per second.

    function updateSupportKeyboard(timestamp) {
        const elapsed = previousSupportTime === null
            ? 0
            : Math.min((timestamp - previousSupportTime) / 1000, 0.05);

        previousSupportTime = timestamp;

        if (world !== keyboardWorld) {
            keyboardWorld = world;
            clearSupportKeys();
        }
        syncMovementButtons();

        const canMove =
            document.activeElement === canvas &&
            !document.hidden &&
            !gameMenu.open &&
            sceneSelect.value === "suspension" &&
            world &&
            !paused &&
            !finished &&
            !world.conservativeMode &&
            !world.stoppedForSlack;

        if (!canMove) {
            clearSupportKeys();
        } else {
            const left =
                heldSupportKeys.has("a") ||
                heldSupportKeys.has("ArrowLeft") ||
                heldSupportKeys.has("touch-left");

            const right =
                heldSupportKeys.has("d") ||
                heldSupportKeys.has("ArrowRight") ||
                heldSupportKeys.has("touch-right");

            const direction = Number(right) - Number(left);

            if (world.ropeState && world.ropeState !== "broken") {
                const reelIn =
                    heldSupportKeys.has("u") ||
                    heldSupportKeys.has("Numpad8");

                const payOut =
                    heldSupportKeys.has("j") ||
                    heldSupportKeys.has("Numpad2");

                world.lengthTarget = Math.max(
                    world.minLength,
                    Math.min(
                        world.maxLength,
                        world.lengthTarget +
                        (Number(payOut) - Number(reelIn)) * 0.5 * elapsed
                    )
                );
            }

            const up =
                heldSupportKeys.has("w") ||
                heldSupportKeys.has("ArrowUp") ||
                heldSupportKeys.has("touch-up");

            const down =
                heldSupportKeys.has("s") ||
                heldSupportKeys.has("ArrowDown") ||
                heldSupportKeys.has("touch-down");

            if (world.verticalEnabled) {
                world.supportHeightTarget = Math.max(
                    world.supportHeightMin,
                    Math.min(
                        world.supportHeightMax,
                        world.supportHeightTarget +
                        (Number(up) - Number(down)) * 1.0 * elapsed
                    )
                );
            }

            if (direction !== 0) {
                const minimum = Number(supportTargetInput.min);
                const maximum = Number(supportTargetInput.max);

                world.supportTarget = Math.max(
                    minimum,
                    Math.min(
                        maximum,
                        world.supportTarget +
                        direction * supportKeyboardSpeed * elapsed
                    )
                );

                supportTargetInput.value = String(world.supportTarget);
                supportTargetValue.textContent =
                    world.supportTarget.toFixed(1) + " m";
            }
        }

        requestAnimationFrame(updateSupportKeyboard);
    }

    requestAnimationFrame(updateSupportKeyboard);

    // Start ready to play without requiring a click.
    focusGame();

    // Preserve the help button and explanation attached to each control.
    function moveWithHelp(id, destination) {
        const control = document.getElementById(id);
        if (!control) return;

        const unit = control.closest(".help-unit") || control;
        destination.append(unit);
    }

    // Primary game controls stay over the canvas.
    for (const id of [
        "menuButton",
        "pauseButton",
        "restartButton",
    ]) {
        moveWithHelp(id, toolbar);
    }

    // Move the remaining settings groups into the menu.
    for (const group of document.querySelectorAll("main > .controls")) {
        settingsContent.append(group);
    }

    // Move the physics visuals checkboxes.
    const visuals = document.getElementById("showVelocity")
        ?.closest("fieldset");

    if (visuals) {
        const selectAllLabel = document.createElement("label");
        selectAllLabel.className = "visuals-select-all";

        const selectAll = document.createElement("input");
        selectAll.type = "checkbox";
        selectAll.id = "selectAllVisuals";

        selectAllLabel.append(
            selectAll,
            document.createTextNode(" Select all physics visuals")
        );

        const legend = visuals.querySelector("legend");

        if (legend) {
            legend.after(selectAllLabel);
        } else {
            visuals.prepend(selectAllLabel);
        }

        const visualOptions = [
            showVelocity,
            showForce,
            showEnergy,
            showCoordinates,
        ];

        function syncSelectAll() {
            const checkedCount =
                visualOptions.filter(option => option.checked).length;

            selectAll.checked = checkedCount === visualOptions.length;
            selectAll.indeterminate =
                checkedCount > 0 && checkedCount < visualOptions.length;
        }

        selectAll.addEventListener("change", () => {
            const checked = selectAll.checked;

            for (const option of visualOptions) {
                option.checked = checked;
                option.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }

            syncSelectAll();
        });

        for (const option of visualOptions) {
            option.addEventListener("change", syncSelectAll);
        }

        syncSelectAll();
        settingsContent.append(visuals);
    }

    // Move conservative mode; leave the support slider beside the game.
    settingsContent.append(conservativeModeLabel);

    document.getElementById("mainMenuActions").after(
        liftLevelControls
    );

    // Start drawing after the game containers and controls exist.
    requestAnimationFrame(frame);
});

wireKeyboardControls();
restartSimulation();
runSuspensionPeriodValidation();