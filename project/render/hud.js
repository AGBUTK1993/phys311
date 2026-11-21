// Diagnostics only: this module never changes the physical world.
let lastTextUpdate = -Infinity;
let lastTextWorld = null;
let debugEnabled =
  new URLSearchParams(window.location.search).get("debug") === "1";
let debugButton = null;
const DRIFT_TOLERANCE_PERCENT = 0.1;

function toggleDebug() {
  debugEnabled = !debugEnabled;
  if (debugButton) {
    debugButton.textContent = debugEnabled ? "Hide debug (D)" : "Show debug (D)";
    debugButton.setAttribute("aria-pressed", String(debugEnabled));
  }
  lastTextUpdate = -Infinity;
}

window.addEventListener("keydown", (event) => {
  const target = event.target;
  if (
    event.defaultPrevented || event.repeat ||
    event.ctrlKey || event.altKey || event.metaKey ||
    target?.isContentEditable ||
    target?.closest?.("input, select, textarea, button, [role='textbox']")
  ) return;

  if (event.key.toLowerCase() === "d") {
    event.preventDefault();
    toggleDebug();
  }
});

export function drawHUD(ctx, world, initialEnergy, stats) {
  if (!debugButton) {
    debugButton = document.createElement("button");
    debugButton.type = "button";
    debugButton.textContent = debugEnabled ? "Hide debug (D)" : "Show debug (D)";
    debugButton.setAttribute("aria-pressed", String(debugEnabled));
    debugButton.addEventListener("click", toggleDebug);
        document.getElementById("menuSettingsContent").append(debugButton);
  }

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

  if (debugEnabled) {
    ctx.save();
    const left = ctx.canvas.logicalWidth - 475;
    ctx.fillStyle = "rgba(245, 247, 250, 0.95)";
    ctx.fillRect(left, 15, 460, 26 + lines.length * 22);
    ctx.font = "16px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    lines.forEach((line, index) => {
      ctx.fillStyle = index === 3 && excessiveDrift ? "#c62828" : "#222";
      ctx.fillText(line, left + 12, 28 + index * 22);
    });
    ctx.restore();
  }

  const now = performance.now();
  if (world !== lastTextWorld || now - lastTextUpdate >= 250) {
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
