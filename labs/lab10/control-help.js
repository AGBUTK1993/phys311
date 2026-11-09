import { runPartCValidation } from "./part-c-validation.js";

// UI-only module: physics remains inside the existing engine modules.
const sceneSelect = document.getElementById("sceneSelect");
const scene = () => sceneSelect.value;
const boxOnly = text => scene() === "box" ? text : "Inactive in this scene. " + text;
const descriptions = {
    sceneSelect: ["Scene", () => "Switch between projectile motion and collisions, gravitational orbits, and a spring chain. Changing scenes starts a new run."],
    integratorSelect: ["Integrator", () => "Velocity Verlet is the recommended default. Euler–Cromer updates velocity first; Euler updates position using the old velocity. Euler can add energy and become unstable in springs or orbits. Changing method does not reset the current state."],
    restitutionInput: ["Restitution", () => boxOnly("Ball box: restitution (0–1) controls retained normal relative speed after impact. At 1 collisions are elastic; lower values dissipate kinetic energy. Tangential speed is unchanged by frictionless walls.")],
    bodyCountSelect: ["Balls", () => boxOnly("Ball box: choosing 20, 50, 100, or 200 rebuilds the scene with that many initial balls. Launches can add more, up to 250 total.")],
    interactionSelect: ["Interaction", () => scene() === "gravity"
        ? "Dragging and launching are inactive in the orbit scene so the small orbiting masses are not disturbed. You can still use playback, zoom, and visuals."
        : scene() === "springs" ? "Choose Grab with spring to pull a mass using a damped spring. Release preserves its current velocity. Launch mode is only available in the ball box."
        : "Grab with spring pulls an existing ball. Launch a ball: press empty space inside the box, pull backward, and release. Longer pulls increase speed up to 12 m/s. The dashed preview is free flight for up to 3 seconds; it stops at a wall and ignores other balls. Keyboard aiming is explained below."],
    durationSelect: ["Run duration", () => "Simulated seconds, not wall-clock time. Apply a new duration with Restart or a scene change. Unlimited has no timer stop. Seeded run and Replay always use 60 simulated seconds."],
    restartButton: ["Restart", () => "Rebuild this scene, apply the selected duration, and reset time and diagnostic comparisons. This clears launched balls and ends a seeded/replay run."],
    pauseButton: ["Pause or resume", () => "Pause or resume physics. Rendering stays active so aiming and view changes still work. After completion, use Restart. Shortcut: Space when no form control is focused."],
    stepButton: ["Single step", () => "Pause and advance exactly one fixed physics step (1/240 second). Shortcut: period (.) when no form control is focused."],
    speedInput: ["Playback speed", () => "0.25×–2× changes how quickly simulated time advances. The physics step stays fixed at 1/240 second. Shortcut: − or + when no form control is focused."],
    seededRunButton: ["Seeded run", () => "Start a reproducible 60-second ball-box run with seed 31109 and zero downward gravity. Physical controls are locked during the test; Restart cancels it. The final state becomes a reference."],
    replayButton: ["Replay", () => "After a seeded reference finishes, repeat its saved settings and compare final physical states byte for byte. Results appear below the canvas. Restart cancels the test."],
    gravityInput: ["Downward gravity", () => scene() === "gravity"
        ? "Inactive here. Orbits use mutual gravitational attraction, not this uniform downward field."
        : boxOnly("Ball box: uniform downward acceleration from 0 to 10 m/s². A larger value curves projectile paths more sharply. Changing it starts a new energy comparison.")],
    stiffnessInput: ["Spring stiffness", () => scene() === "springs"
        ? "Hooke's-law stiffness from 1 to 40 N/m. Larger values produce stronger restoring forces and faster oscillation. Changing stiffness starts a new energy comparison. The fixed step supports this range with Verlet/Euler–Cromer; ordinary Euler can still grow unstable."
        : "Inactive here. This slider changes the spring-chain connections, not the grabbing spring."],
    showVelocity: ["Velocity arrows", () => "Blue arrows show direction and relative speed. Arrow size changes display magnification only. Long arrows are capped; compare uncapped arrows for magnitude."],
    showForce: ["Force arrows", () => "Force arrows show the most recently calculated continuous net force. Collision impulses are not shown. " + (scene() === "box" ? "With zero gravity and no dragging, continuous force is zero." : scene() === "gravity" ? "Orbit forces can be small; increase Arrow size to see them." : "Spring forces show how displaced masses pull on their neighbors.")],
    showEnergy: ["Energy graph", () => "Recent total mechanical energy, with an automatically scaled vertical axis. Dragging does external work and launching adds a body; parameter changes alter the energy comparison. These interactive changes are not conservation tests."],
    zoomInput: ["View zoom", () => "Magnify the view around its center from 0.5× to 3×. This does not change physics. Bodies near the edges may move out of view. Reset view returns to 1×."],
    resetViewButton: ["Reset view", () => "Restore 1× zoom without restarting the simulation."],
    arrowScaleInput: ["Arrow size", () => "Magnify velocity and force arrows from 0.25× to 10× without changing physics. The two types use different display scales and long arrows remain capped."],
};

let active = null, pinned = false, closeTimer;
const items = [];
function closeHelp() {
    clearTimeout(closeTimer);
    if (active) {
        active.tip.hidden = true;
        active.button.setAttribute("aria-expanded", "false");
    }
    active = null;
    pinned = false;
}
function placeHelp() {
    if (!active) return;
    const rect = active.button.getBoundingClientRect();
    const tip = active.tip;
    const width = tip.offsetWidth, height = tip.offsetHeight;
    const left = Math.max(12, Math.min(rect.left, innerWidth - width - 12));
    let top = rect.bottom + 6;
    if (top + height > innerHeight - 12) top = rect.top - height - 6;
    tip.style.left = left + "px";
    tip.style.top = Math.max(12, Math.min(top, innerHeight - height - 12)) + "px";
}
function showHelp(item) {
    clearTimeout(closeTimer);
    if (active !== item) closeHelp();
    active = item;
    item.tip.textContent = item.text();
    item.tip.hidden = false;
    item.button.setAttribute("aria-expanded", "true");
    placeHelp();
}
function delayedClose(item) {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(() => {
        if (active === item && !pinned &&
            document.activeElement !== item.button &&
            !item.button.matches(":hover") && !item.tip.matches(":hover")) closeHelp();
    }, 180);
}

for (const [id, [name, text]] of Object.entries(descriptions)) {
    const control = document.getElementById(id);
    if (!control) continue;
    const label = control.closest("label");
    const anchor = label || control;
    const group = document.createElement("span");
    group.className = "help-unit";
    anchor.before(group);
    group.append(anchor);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "help-button";
    button.textContent = "?";
    button.setAttribute("aria-label", `Help: ${name}`);
    button.setAttribute("aria-expanded", "false");
    const tip = document.createElement("div");
    tip.id = `help-${id}`;
    tip.className = "control-tooltip";
    tip.setAttribute("role", "tooltip");
    tip.hidden = true;
    tip.textContent = text();
    button.setAttribute("aria-describedby", tip.id);
    button.setAttribute("aria-controls", tip.id);
    group.append(button);
    document.body.append(tip);
    const item = { button, tip, text };
    items.push(item);
    button.addEventListener("pointerenter", event => {
        if (event.pointerType !== "touch") showHelp(item);
    });
    button.addEventListener("focus", () => showHelp(item));
    button.addEventListener("pointerleave", () => delayedClose(item));
    button.addEventListener("blur", () => {
        if (active === item) { pinned = false; delayedClose(item); }
    });
    tip.addEventListener("pointerenter", () => clearTimeout(closeTimer));
    tip.addEventListener("pointerleave", () => delayedClose(item));
    button.addEventListener("click", () => {
        if (active === item && pinned) closeHelp();
        else { showHelp(item); pinned = true; }
    });
}
document.addEventListener("keydown", event => {
    if (event.key === "Escape" && active) {
        event.preventDefault();
        closeHelp();
    }
});
document.addEventListener("pointerdown", event => {
    if (active && !active.button.contains(event.target) && !active.tip.contains(event.target)) closeHelp();
});
window.addEventListener("resize", placeHelp);
window.addEventListener("scroll", placeHelp, true);

// Keep all existing explanation text available, but collapse the long reference.
const main = document.querySelector("main");
const reference = document.createElement("details");
reference.className = "reference-details";
const summary = document.createElement("summary");
summary.textContent = "Keyboard controls and detailed instructions";
reference.append(summary);
const starts = ["Keyboard shortcuts", "Gravity and restitution", "Grab mode:",
    "Zoom changes", "Velocity arrows show", "Keyboard: Tab", "Duration is measured"];
for (const paragraph of Array.from(main.children)) {
    if (paragraph.tagName === "P" && starts.some(start => paragraph.textContent.trim().startsWith(start))) {
        reference.append(paragraph);
    }
}
const canvas = document.getElementById("sim");
canvas.before(reference);
const note = document.createElement("p");
note.className = "help-note";
note.textContent = "Hover, Tab to, or tap a ? for help. Escape closes it. Keyboard instructions are expandable below.";
document.getElementById("status").after(note);
const purpose = document.getElementById("purposeHeading")?.closest("section");
const sceneCopy = {
    box: ["Launch, Fall, and Bounce", "Explore how gravity curves a projectile's path and restitution changes its bounce.",
        "Try it: choose Launch a ball, set gravity to 2 m/s², then press empty space in the box, pull backward, and release. Use the ? beside Mouse action for details."],
    gravity: ["Gravitational Orbits", "Explore motion under mutual gravitational attraction and compare energy behavior between integrators.",
        "Try it: turn on velocity and force arrows, then increase Arrow size. Watch the direction of force as each body moves. Restart before comparing different integrators."],
    springs: ["Coupled Spring Motion", "Explore how Hooke's-law forces transmit motion along a chain of masses.",
        "Try it: choose Grab with spring, pull a mass, and release. Turn on force arrows and the energy graph. Dragging supplies external work; the fixed anchor means body momentum need not be conserved."],
};
let lastScene;
function updateSceneHelp() {
    if (scene() === lastScene) return;
    lastScene = scene();
    const copy = sceneCopy[lastScene] || sceneCopy.box;
    if (purpose) {
        purpose.querySelector("h2").textContent = copy[0];
        const paragraphs = purpose.querySelectorAll("p");
        paragraphs.forEach((p, i) => {
            p.textContent = copy[i + 1] || "";
            p.hidden = i > 1;
        });
    }
    for (const item of items) item.tip.textContent = item.text();
    placeHelp();
}
sceneSelect.addEventListener("change", updateSceneHelp);
// Seeded runs set the scene programmatically, then update status.
new MutationObserver(updateSceneHelp).observe(document.getElementById("status"), { childList: true, subtree: true });
updateSceneHelp();

const validation = document.createElement("details");
validation.className = "validation-details";
const validationSummary = document.createElement("summary");
validationSummary.textContent = "Physics validation (separate test worlds)";
const run = document.createElement("button");
run.type = "button";
run.textContent = "Run Part C validation";
const result = document.createElement("pre");
result.textContent = "Not run yet. These tests do not change the visible scene. Pause first to avoid including test time in a performance measurement.";
const announcement = document.createElement("p");
announcement.setAttribute("role", "status");
validation.append(validationSummary, run, announcement, result);
main.append(validation);
run.addEventListener("click", () => {
    try {
        const data = runPartCValidation();
        announcement.textContent = data.passed ? "All Part C checks passed." : "At least one check failed. Inspect the results.";
        result.textContent = "60 simulated seconds; dt=1/240 s; 14400 Verlet steps.\n" +
            "Free flight: g=2 m/s², position=(2,5) m, velocity=(3,4) m/s; no collisions.\n" +
            "Analytic reference: x=2+3t, y=5+4t−t².\n\n" +
            data.rows.map(r => `${r.passed ? "PASS" : "FAIL"} | ${r.test}\n` +
                `  measured=${r.measured.toExponential(6)} ${r.unit}; expected=${r.expected}; tolerance=${r.tolerance}`).join("\n");
    } catch (error) {
        announcement.textContent = "Validation could not finish.";
        result.textContent = String(error);
        console.error(error);
    }
});
