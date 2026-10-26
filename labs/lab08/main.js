"use strict";

import { Vec2 } from "./vec2.js";
import { Body } from "./body.js";
import { eulerCromer, velocityVerlet } from "./integrators.js";

// Find the canvas and get its drawing tools.
const canvas = document.getElementById("sim");
const ctx = canvas.getContext("2d");

console.log("Lab 8: main.js loaded successfully.");
console.log(`Canvas size: ${canvas.width} × ${canvas.height} pixels`);

// Part A: compare vector operations with hand-calculated answers.
const a = new Vec2(3, 4);
const b = new Vec2(1, -2);

const sum = a.add(b);
const difference = a.sub(b);
const scaled = a.mul(2);
const unit = a.normalized();

// Clone first so the in-place tests do not change a.
const addedInPlace = a.clone();
addedInPlace.addTo(b);

const scaledInPlace = a.clone();
scaledInPlace.addScaled(b, 2);

// Changing a copy should leave the original unchanged.
const independentCopy = a.clone();
independentCopy.set(99, 99);

const zeroUnit = new Vec2(0, 0).normalized();
const tolerance = 1e-12;

function check(name, actual, expected) {
    const passed = actual.length === expected.length &&
        actual.every((value, i) =>
            Math.abs(value - expected[i]) <= tolerance
        );

    return {
        Test: name,
        Actual: actual.join(", "),
        Expected: expected.join(", "),
        Result: passed ? "PASS" : "FAIL"
    };
}

const results = [
    check("a + b", [sum.x, sum.y], [4, 2]),
    check("a - b", [difference.x, difference.y], [2, 6]),
    check("2a", [scaled.x, scaled.y], [6, 8]),
    check("a dot b", [a.dot(b)], [-5]),
    check("|a| squared", [a.lengthSq()], [25]),
    check("|a|", [a.length()], [5]),
    check("Normalized a", [unit.x, unit.y], [0.6, 0.8]),
    check("In-place addition", [addedInPlace.x, addedInPlace.y], [4, 2]),
    check("In-place a + 2b", [scaledInPlace.x, scaledInPlace.y], [5, 0]),
    check("Original a unchanged", [a.x, a.y], [3, 4]),
    check("Independent copy changed", [independentCopy.x, independentCopy.y], [99, 99]),
    check("Normalize zero", [zeroUnit.x, zeroUnit.y], [0, 0])
];

console.table(results);

const allPassed = results.every(row => row.Result === "PASS");
console.log(`Vec2 self-tests: ${allPassed ? "ALL PASSED" : "CHECK FAILURES"}`);

// Part A: convert physics coordinates (meters) to canvas pixels.
class Camera {
    constructor(canvas, scale = 50, originX = 60, bottomMargin = 50) {
        this.scale = scale;
        this.originX = originX;
        this.originY = canvas.height - bottomMargin;
    }

    toScreen(position) {
        return {
            x: this.originX + position.x * this.scale,
            y: this.originY - position.y * this.scale
        };
    }
}

const camera = new Camera(canvas);

// Draw a line between two points given in physics coordinates.
function drawPhysicsLine(start, end, color = "#dddddd", width = 1) {
    const p = camera.toScreen(start);
    const q = camera.toScreen(end);

    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(q.x, q.y);
    ctx.stroke();
}

function drawStaticScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxX = Math.floor(
        (canvas.width - camera.originX - 30) / camera.scale
    );
    const maxY = Math.floor(
        (camera.originY - 30) / camera.scale
    );

    ctx.font = "14px Arial";
    ctx.fillStyle = "#333333";

    // Vertical grid lines and x-axis ticks, spaced every meter.
    for (let x = 0; x <= maxX; x++) {
        drawPhysicsLine(new Vec2(x, 0), new Vec2(x, maxY));

        const p = camera.toScreen(new Vec2(x, 0));
        ctx.strokeStyle = "#333333";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - 5);
        ctx.lineTo(p.x, p.y + 5);
        ctx.stroke();

        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(String(x), p.x, p.y + 10);
    }

    // Horizontal grid lines and y-axis ticks, spaced every meter.
    for (let y = 0; y <= maxY; y++) {
        drawPhysicsLine(new Vec2(0, y), new Vec2(maxX, y));

        const p = camera.toScreen(new Vec2(0, y));
        ctx.strokeStyle = "#333333";
        ctx.beginPath();
        ctx.moveTo(p.x - 5, p.y);
        ctx.lineTo(p.x + 5, p.y);
        ctx.stroke();

        ctx.textAlign = "right";
        ctx.textBaseline = "middle";
        ctx.fillText(String(y), p.x - 12, p.y);
    }

    // Emphasize the ground and vertical axis.
    drawPhysicsLine(new Vec2(0, 0), new Vec2(maxX, 0), "#287a38", 2);
    drawPhysicsLine(new Vec2(0, 0), new Vec2(0, maxY), "#333333", 2);

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("x (m)", canvas.width - 15, canvas.height - 5);

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("y (m)", 10, 10);

    // Convert the circle's position and radius only when drawing.
    const circlePosition = new Vec2(2, 3);
    const circleRadius = 0.3;
    const center = camera.toScreen(circlePosition);

    ctx.fillStyle = "#ff8200";
    ctx.beginPath();
    ctx.arc(
        center.x,
        center.y,
        circleRadius * camera.scale,
        0,
        2 * Math.PI
    );
    ctx.fill();

    ctx.fillStyle = "#222222";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(
        "Center: (2, 3) m; radius: 0.3 m",
        center.x + 25,
        center.y
    );

    console.log(
        `Circle center: (${center.x}, ${center.y}) canvas pixels`
    );
    console.log(
        `Height above ground: ${camera.originY - center.y} pixels`
    );
    console.log(`Circle radius: ${circleRadius * camera.scale} pixels`);
}

drawStaticScene();

// Part B: check the translated Body class.
const startingPosition = new Vec2(2, 3);

const testBody = new Body({
    m: 2,
    pos: startingPosition,
    vel: new Vec2(3, 4),
    radius: 0.3
});

// Changing the original vector should not move the body.
startingPosition.set(99, 99);

// Check that accumulated force can be cleared.
testBody.force.set(10, -20);
testBody.clearForce();

console.log("Body self-test:");
console.log(`Mass: ${testBody.m} kg`);
console.log(`Position: (${testBody.pos.x}, ${testBody.pos.y}) m`);
console.log(`Speed: ${testBody.vel.length()} m/s`);
console.log(`Kinetic energy: ${testBody.kineticEnergy()} J`);
console.log(
    `Force after clearing: (${testBody.force.x}, ${testBody.force.y}) N`
);

// Part B: uniform gravity and a one-step integrator check.
const GRAVITY = 9.81;

// Add gravitational force to each body's force accumulator.
function applyGravity(bodies) {
    for (const body of bodies) {
        body.force.y -= body.m * GRAVITY;
    }
}

const testDt = 0.1;

const ecTestBody = new Body({
    m: 1,
    pos: new Vec2(0, 0),
    vel: new Vec2(10, 10)
});

const verletTestBody = new Body({
    m: 1,
    pos: new Vec2(0, 0),
    vel: new Vec2(10, 10)
});

eulerCromer([ecTestBody], testDt, applyGravity);
velocityVerlet([verletTestBody], testDt, applyGravity);

console.log("One-step integrator check: dt = 0.1 s");

console.table([
    {
        Method: "Euler-Cromer",
        x: ecTestBody.pos.x.toFixed(6),
        y: ecTestBody.pos.y.toFixed(6),
        vx: ecTestBody.vel.x.toFixed(6),
        vy: ecTestBody.vel.y.toFixed(6)
    },
    {
        Method: "Velocity Verlet",
        x: verletTestBody.pos.x.toFixed(6),
        y: verletTestBody.pos.y.toFixed(6),
        vx: verletTestBody.vel.x.toFixed(6),
        vy: verletTestBody.vel.y.toFixed(6)
    }
]);

// Part B: animate a projectile using fixed physics time steps.
let FIXED_DT = 1 / 120;
const LAUNCH_SPEED = 20;
const LAUNCH_ANGLE = 50 * Math.PI / 180;

let projectile;
let simulationTime = 0;
let accumulator = 0;
let previousTimestamp = null;
let animationRunning = false;
// Remember the most recent 200 positions for the fading trail.
const TRAIL_LIMIT = 200;
let trail = [];

// Store the selected integration function.
let selectedIntegrator = eulerCromer;

// Add a launch button above the canvas.
const launchButton = document.createElement("button");
launchButton.textContent = "Launch projectile";
launchButton.style.marginBottom = "12px";
canvas.before(launchButton);

// Create a fresh projectile and reset the simulation clock.
function resetProjectile() {
    projectile = new Body({
        m: 1,
        pos: new Vec2(0, 0),
        vel: new Vec2(
            LAUNCH_SPEED * Math.cos(LAUNCH_ANGLE),
            LAUNCH_SPEED * Math.sin(LAUNCH_ANGLE)
        ),
        radius: 0.3
    });

    simulationTime = 0;
    accumulator = 0;
    previousTimestamp = null;
    // Begin each flight with only its initial position.
    trail = [projectile.pos.clone()];

    // Zoom out so the complete trajectory fits on the canvas.
    camera.scale = 20;
}

// Draw the coordinate grid and the projectile's current position.
function drawProjectileScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxX = Math.floor(
        (canvas.width - camera.originX - 30) / camera.scale
    );
    const maxY = Math.floor(
        (camera.originY - 30) / camera.scale
    );

    ctx.font = "12px Arial";
    ctx.fillStyle = "#333333";

    // Grid lines remain spaced one meter apart.
    for (let x = 0; x <= maxX; x++) {
        drawPhysicsLine(new Vec2(x, 0), new Vec2(x, maxY));

        // Label every fifth line to keep the numbers readable.
        if (x % 5 === 0) {
            const point = camera.toScreen(new Vec2(x, 0));
            ctx.textAlign = "center";
            ctx.textBaseline = "top";
            ctx.fillText(String(x), point.x, point.y + 10);
        }
    }

    for (let y = 0; y <= maxY; y++) {
        drawPhysicsLine(new Vec2(0, y), new Vec2(maxX, y));

        if (y % 5 === 0) {
            const point = camera.toScreen(new Vec2(0, y));
            ctx.textAlign = "right";
            ctx.textBaseline = "middle";
            ctx.fillText(String(y), point.x - 12, point.y);
        }
    }

    drawPhysicsLine(
        new Vec2(0, 0), new Vec2(maxX, 0), "#287a38", 2
    );
    drawPhysicsLine(
        new Vec2(0, 0), new Vec2(0, maxY), "#333333", 2
    );

    ctx.textAlign = "right";
    ctx.textBaseline = "bottom";
    ctx.fillText("x (m)", canvas.width - 15, canvas.height - 5);

    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("y (m)", 10, 10);

    drawTrail();
    const center = camera.toScreen(projectile.pos);

    ctx.fillStyle = "#ff8200";
    ctx.beginPath();
    ctx.arc(
        center.x,
        center.y,
        projectile.radius * camera.scale,
        0,
        2 * Math.PI
    );
    ctx.fill();
    ctx.fillStyle = "#ff8200";
    ctx.beginPath();
    ctx.arc(
        center.x,
        center.y,
        projectile.radius * camera.scale,
        0,
        2 * Math.PI
    );
    ctx.fill();

    drawHUD();
}

// Advance the physics, then draw once for this browser frame.
// Compare fixed physics steps with one variable step per frame.
function animate(timestamp) {
    if (!animationRunning) {
        return;
    }

    if (previousTimestamp === null) {
        previousTimestamp = timestamp;
    }

    const elapsedSeconds = (timestamp - previousTimestamp) / 1000;
    previousTimestamp = timestamp;

    // Apply the same frame-time cap in both modes.
    const frameTime = Math.min(elapsedSeconds, 0.1);

    if (timingSelect.value === "fixed") {
        accumulator += frameTime;

        // A slow frame can require several small physics steps.
        while (accumulator >= FIXED_DT && animationRunning) {
            advanceProjectile(FIXED_DT);
            accumulator -= FIXED_DT;
        }
    } else {
        // Use the measured, capped frame time as one physics step.
        accumulator = 0;

        if (frameTime > 0) {
            advanceProjectile(frameTime);
        }
    }

    drawProjectileScene();

    if (animationRunning) {
        if (lagCheckbox.checked) {
            // Intentionally keep the browser busy for 50 milliseconds.
            const lagStart = performance.now();

            while (performance.now() - lagStart < 50) {
                // Deliberately empty: this creates lag for the experiment.
            }
        }

        requestAnimationFrame(animate);
    }
}

// Clicking the button starts a new flight.
launchButton.addEventListener("click", () => {
    if (animationRunning) {
        return;
    }

    resetProjectile();
    animationRunning = true;
    launchButton.disabled = true;
    requestAnimationFrame(animate);
});

// Draw older trail segments faintly and newer segments more strongly.
function drawTrail() {
    ctx.save();
    ctx.strokeStyle = "#ff8200";
    ctx.lineWidth = 2;

    for (let i = 1; i < trail.length; i++) {
        const start = camera.toScreen(trail[i - 1]);
        const end = camera.toScreen(trail[i]);

        // Opacity increases from the oldest segment to the newest.
        ctx.globalAlpha = i / (trail.length - 1);

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }

    // Restore normal opacity and the previous drawing settings.
    ctx.restore();
}

// Display the current physical state in a readable canvas panel.
function drawHUD() {
    const speed = projectile.vel.length();
    const kineticEnergy = projectile.kineticEnergy();
    const potentialEnergy =
        projectile.m * GRAVITY * projectile.pos.y;
    const totalEnergy = kineticEnergy + potentialEnergy;

    const lines = [
        `Method: ${selectedIntegrator === velocityVerlet
            ? "Velocity Verlet"
            : "Euler-Cromer"
        }`,
        `t = ${simulationTime.toFixed(3)} s`,
        `x = ${projectile.pos.x.toFixed(3)} m`,
        `y = ${projectile.pos.y.toFixed(3)} m`,
        `|v| = ${speed.toFixed(3)} m/s`,
        `KE = ${kineticEnergy.toFixed(3)} J`,
        `PE = ${potentialEnergy.toFixed(3)} J`,
        `Total E = ${totalEnergy.toFixed(3)} J`
    ];

    ctx.save();

    // The panel uses canvas pixels rather than physics coordinates.
    ctx.fillStyle = "rgba(255, 255, 255, 0.94)";
    ctx.fillRect(620, 20, 265, 202);

    ctx.strokeStyle = "#555555";
    ctx.lineWidth = 1;
    ctx.strokeRect(620, 20, 265, 202);

    ctx.fillStyle = "#222222";
    ctx.font = "14px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 632, 32 + 23 * i);
    }

    ctx.restore();
}

// Part C1: run a repeatable physics test without animation.
function runHeadlessProjectile(integrator, steps = 1200, dt = 1 / 120) {
    const body = new Body({
        m: 1,
        pos: new Vec2(0, 0),
        vel: new Vec2(
            LAUNCH_SPEED * Math.cos(LAUNCH_ANGLE),
            LAUNCH_SPEED * Math.sin(LAUNCH_ANGLE)
        ),
        radius: 0.3
    });

    const bodies = [body];

    // Advance exactly the requested number of physics steps.
    for (let step = 0; step < steps; step++) {
        integrator(bodies, dt, applyGravity);
    }

    const totalEnergy =
        body.kineticEnergy() + body.m * GRAVITY * body.pos.y;

    return {
        steps: steps,
        dt: dt,
        t: steps * dt,
        x: body.pos.x,
        y: body.pos.y,
        vx: body.vel.x,
        vy: body.vel.y,
        E: totalEnergy
    };
}

// Use a fresh body for each integration method.
const jsComparison = {
    "Euler-Cromer": runHeadlessProjectile(eulerCromer),
    "Velocity Verlet": runHeadlessProjectile(velocityVerlet)
};

console.log("Part C1: JavaScript headless results");
console.table(jsComparison);

// Preserve the numerical values for comparison with Python.
console.log(JSON.stringify(jsComparison, null, 2));

// Part C2: choose how browser frame time advances the physics.
const timingControls = document.createElement("div");
timingControls.style.marginBottom = "12px";

const timingLabel = document.createElement("label");
timingLabel.textContent = "Time stepping: ";

const timingSelect = document.createElement("select");
timingSelect.add(new Option("Fixed time step", "fixed"));
timingSelect.add(new Option("Variable: frame time", "variable"));
timingLabel.append(timingSelect);

const lagLabel = document.createElement("label");
lagLabel.style.marginLeft = "16px";

const lagCheckbox = document.createElement("input");
lagCheckbox.type = "checkbox";
lagLabel.append(lagCheckbox, " Add 50 ms lag per frame");

timingControls.append(timingLabel, lagLabel);
canvas.before(timingControls);

// Keep the settings unchanged during each flight.
launchButton.addEventListener("click", () => {
    timingSelect.disabled = true;
    lagCheckbox.disabled = true;
});

// Advance one physics step and update the recorded trail.
function advanceProjectile(dt) {
    selectedIntegrator([projectile], dt, applyGravity);
    simulationTime += dt;

    trail.push(projectile.pos.clone());

    if (trail.length > TRAIL_LIMIT) {
        trail.shift();
    }

    if (projectile.pos.y < 0) {
        animationRunning = false;
        launchButton.disabled = false;
        timingSelect.disabled = false;
        lagCheckbox.disabled = false;
        methodSelect.disabled = false;
        stepSelect.disabled = false;
    }
}// Part C3: select the integration method and fixed step size.
const methodControls = document.createElement("div");
methodControls.style.marginBottom = "12px";

const methodLabel = document.createElement("label");
methodLabel.textContent = "Integrator: ";

const methodSelect = document.createElement("select");
methodSelect.add(new Option("Euler-Cromer", "ec"));
methodSelect.add(new Option("Velocity Verlet", "verlet"));
methodLabel.append(methodSelect);

const stepLabel = document.createElement("label");
stepLabel.textContent = " Fixed step size: ";
stepLabel.style.marginLeft = "16px";

const stepSelect = document.createElement("select");
stepSelect.add(new Option("1/120 s", String(1 / 120)));
stepSelect.add(new Option("1/20 s", String(1 / 20)));
stepLabel.append(stepSelect);

methodControls.append(methodLabel, stepLabel);
canvas.before(methodControls);

// Choose which existing integration function advances the body.
methodSelect.addEventListener("change", () => {
  selectedIntegrator =
    methodSelect.value === "ec" ? eulerCromer : velocityVerlet;
});

// Dropdown values are text, so convert the selected value to a number.
stepSelect.addEventListener("change", () => {
  FIXED_DT = Number(stepSelect.value);
});

// Keep each flight's method and step size unchanged.
launchButton.addEventListener("click", () => {
  methodSelect.disabled = true;
  stepSelect.disabled = true;
});