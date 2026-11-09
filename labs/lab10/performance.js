// Collect averages across many animation frames.
export class PerformanceRecorder {
  constructor(outputElement) {
    this.outputElement = outputElement;
    this.results = new Map();
    this.active = false;
  }

  start(bodyCount, method, restitution) {
    this.bodyCount = bodyCount;
    this.method = method;
    this.restitution = restitution;

    this.warmupSeconds = 0;
    this.measuredSeconds = 0;
    this.frames = 0;
    this.physicsTotal = 0;
    this.renderTotal = 0;
    this.simulatedSeconds = 0;

    this.active = true;
  }

  stop() {
    this.active = false;
  }

  record(elapsed, physicsMs, renderMs, simulatedAdvance) {
    if (!this.active || elapsed <= 0) return;

    // Allow the browser to warm up before collecting results.
    if (this.warmupSeconds < 2) {
      this.warmupSeconds += elapsed;
      return;
    }

    this.measuredSeconds += elapsed;
    this.frames++;
    this.physicsTotal += physicsMs;
    this.renderTotal += renderMs;
    this.simulatedSeconds += simulatedAdvance;

    if (this.measuredSeconds < 10) return;

    this.active = false;

    const result = {
      bodies: this.bodyCount,
      method: this.method,
      restitution: this.restitution,
      physicsMs: this.physicsTotal / this.frames,
      renderMs: this.renderTotal / this.frames,
      fps: this.frames / this.measuredSeconds,
      simulationRate: this.simulatedSeconds / this.measuredSeconds,
    };

    // Repeating the same configuration replaces its previous result.
    const key =
      `${this.bodyCount}-${this.method}-${this.restitution}`;

    this.results.set(key, result);
    this.showResults();
  }

  showResults() {
    const rows = [...this.results.values()];

    console.table(
      rows.map((row) => ({
        bodies: row.bodies,
        method: row.method,
        e: row.restitution,
        "physics ms/frame": row.physicsMs.toFixed(3),
        "render ms/frame": row.renderMs.toFixed(3),
        FPS: row.fps.toFixed(1),
        "sim seconds / real second":
          row.simulationRate.toFixed(3),
      }))
    );

    const lines = [
      "Performance averages",
      "Physics and render times are milliseconds per frame.",
      "",
    ];

    for (const row of rows) {
      lines.push(
        `${row.bodies} balls | ${row.method} | e = ${row.restitution}`,
        `Physics: ${row.physicsMs.toFixed(3)} ms/frame`,
        `Render:  ${row.renderMs.toFixed(3)} ms/frame`,
        `FPS:     ${row.fps.toFixed(1)}`,
        `Simulation rate: ${row.simulationRate.toFixed(3)} s/s`,
        ""
      );
    }

    this.outputElement.textContent = lines.join("\n");
  }
}