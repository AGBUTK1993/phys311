// Diagnostics only: this module never changes the physical world.
let lastTextUpdate = -Infinity;
let lastTextWorld = null;
let debugEnabled =
  new URLSearchParams(window.location.search).get("debug") === "1";
let debugButton = null;
let debugPanel = null;
const DRIFT_TOLERANCE_PERCENT = 0.1;

export function toggleDebug() {
  debugEnabled = !debugEnabled;
  if (debugButton) {
    debugButton.textContent = debugEnabled ? "Hide Debug Panel (B)" : "Show Debug Panel (B)";
    debugButton.setAttribute("aria-pressed", String(debugEnabled));
  }
  if (debugPanel) debugPanel.hidden = !debugEnabled;
  lastTextUpdate = -Infinity;
}

export function drawHUD(ctx, world, initialEnergy, stats) {
  const gameArea = ctx.canvas.closest(".game-area");
  if (!gameArea) return;
  if (!debugButton) {
    debugButton = document.createElement("button");
    debugButton.type = "button";
    debugButton.id = "debugToggleButton";
    debugButton.textContent = debugEnabled ? "Hide Debug Panel (B)" : "Show Debug Panel (B)";
    debugButton.setAttribute("aria-pressed", String(debugEnabled));
    debugButton.addEventListener("click", toggleDebug);
    document.getElementById("menuSettingsContent").append(debugButton);
  }

  if (!debugPanel) {
    debugPanel = document.createElement("pre");
    debugPanel.className = "game-debug-panel";
    debugPanel.setAttribute("role", "region");
    debugPanel.setAttribute("aria-label", "Debug panel");
    debugPanel.tabIndex = 0;

    gameArea.append(debugPanel);
  }

  debugPanel.hidden = !debugEnabled;

  const energy = world.totalEnergy();
  const momentum = world.totalMomentum();
  const driftPercent = initialEnergy === 0
    ? null
    : 100 * (energy - initialEnergy) / Math.abs(initialEnergy);
  const excessiveDrift = driftPercent !== null &&
    Math.abs(driftPercent) > DRIFT_TOLERANCE_PERCENT;

  let maxSpeed = 0;
  for (const body of world.bodies) {
    if (!body.isStatic) {
      maxSpeed = Math.max(maxSpeed, Math.hypot(body.vel.x, body.vel.y));
    }
  }

  const lines = [
    `Time: ${world.time.toFixed(6)} s`,
    `Bodies: ${world.bodies.length}`,
    `Total energy: ${energy.toFixed(6)} J`,
    driftPercent === null
      ? `Energy change: ${(energy - initialEnergy).toExponential(3)} J (E0 = 0)`
      : `Energy change: ${driftPercent.toFixed(6)} %`,
    `|Momentum|: ${Math.hypot(momentum.x, momentum.y).toFixed(4)} kg m/s`,
    `Contacts resolved / step: ${world.contactsResolved ?? "N/A"}`,
    `Max dynamic-body speed: ${maxSpeed.toFixed(4)} m/s`,
    `FPS: ${stats.fps.toFixed(1)}`,
    `Physics: ${stats.physicsMs.toFixed(3)} ms/frame`,
    `Render: ${stats.renderMs.toFixed(3)} ms/frame`,
    `Energy-change alert: > ${DRIFT_TOLERANCE_PERCENT}%`,
  ];

  if (world.rope && !world.conservativeMode) {
    lines.push("Motor/damping: energy change is expected.");
  }

  const now = performance.now();
  if (world !== lastTextWorld || now - lastTextUpdate >= 250) {
    debugPanel.textContent = lines.join("\n");
    debugPanel.classList.toggle("energy-alert", excessiveDrift);
    const text = document.getElementById("textDiagnostics");
    if (text) {
      text.style.whiteSpace = "pre-line";
      text.textContent = debugEnabled
        ? lines.join("\n")
        : lines.slice(0, 5).join(" | ");
    }
    lastTextWorld = world;
    lastTextUpdate = now;
  }
}
