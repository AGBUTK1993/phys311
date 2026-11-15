// Display diagnostics without changing the physical world.
let lastTextUpdate = -Infinity;
let lastTextWorld = null;
export function drawHUD(ctx, world, initialEnergy, stats) {
  const energy = world.totalEnergy();
  const momentum = world.totalMomentum();
  const momentumMagnitude = Math.hypot(momentum.x, momentum.y);

  const driftPercent = initialEnergy === 0
    ? null
    : 100 * (energy - initialEnergy) / Math.abs(initialEnergy);

  const lines = [
    `Time: ${world.time.toFixed(6)} s`,
    `Bodies: ${world.bodies.length}`,
    `Total energy: ${energy.toFixed(4)} J`,
    driftPercent === null
      ? "Energy change: N/A (initial energy is zero)"
      : `Energy change: ${driftPercent.toFixed(4)} %`,
    `|Momentum|: ${momentumMagnitude.toFixed(4)} kg m/s`,
    `FPS: ${stats.fps.toFixed(1)}`,
    `Physics: ${stats.physicsMs.toFixed(3)} ms/frame`,
    `Render: ${stats.renderMs.toFixed(3)} ms/frame`
  ];

  ctx.save();

  const left = ctx.canvas.logicalWidth - 400;
  ctx.fillStyle = "rgba(245, 247, 250, 0.95)";
  ctx.fillRect(left, 15, 385, 205);

  ctx.font = "17px monospace";
  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  lines.forEach((line, index) => {
    const excessiveDrift =
      index === 3 &&
      driftPercent !== null &&
      Math.abs(driftPercent) > 1;

    ctx.fillStyle = excessiveDrift ? "#c62828" : "#222";
    ctx.fillText(line, left + 12, 28 + index * 23);
  });

  ctx.restore();

  // HTML diagnostics remain readable on small screens.
  const now = performance.now();

  if (world !== lastTextWorld || now - lastTextUpdate >= 250) {
    const text = document.getElementById("textDiagnostics");

    if (text) {
      text.textContent = lines.slice(0, 5).join(" | ");
    }

    lastTextWorld = world;
    lastTextUpdate = now;
  }
}