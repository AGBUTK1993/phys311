function drawArrow(ctx, camera, body, vector, scale, color, label) {
    const magnitude = Math.hypot(vector.x, vector.y);
    if (!Number.isFinite(magnitude) || magnitude < 1e-8) return;

    const start = camera.toScreen(body.pos);

    // Canvas y increases downward, opposite to world y.
    const ux = vector.x / magnitude;
    const uy = -vector.y / magnitude;
    const length = Math.min(80, magnitude * scale);

    const end = {
        x: start.x + ux * length,
        y: start.y + uy * length,
    };

    const angle = Math.atan2(uy, ux);
    const head = Math.min(8, length / 2);

    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
        end.x - head * Math.cos(angle - Math.PI / 6),
        end.y - head * Math.sin(angle - Math.PI / 6)
    );
    ctx.lineTo(
        end.x - head * Math.cos(angle + Math.PI / 6),
        end.y - head * Math.sin(angle + Math.PI / 6)
    );
    ctx.closePath();
    ctx.fill();

    ctx.font = "12px sans-serif";
    ctx.fillText(label, end.x + 4, end.y - 4);
}

export class PhysicsVisuals {
    constructor() {
        this.world = null;
        this.samples = [];
        this.lastSampleTime = -Infinity;
    }

    draw(ctx, camera, world, options) {
        // A restart or scene change creates a new world.
        if (world !== this.world) {
            this.world = world;
            this.samples = [];
            this.lastSampleTime = -Infinity;
        }

        // Store at most ten samples per simulated second.
        // Pausing does not add duplicate points.
        if (world.time - this.lastSampleTime >= 0.1) {
            const energy = world.totalEnergy();

            if (Number.isFinite(energy)) {
                this.samples.push({ time: world.time, energy });
                if (this.samples.length > 300) this.samples.shift();
            }

            this.lastSampleTime = world.time;
        }

        ctx.save();

        for (const body of world.bodies) {
            if (body.isStatic) continue;

            if (options.velocity) {
                drawArrow(
                    ctx, camera, body, body.vel,
                    12 * options.arrowScale, "#005a9c", "v"
                );
            }

            if (options.force) {
                drawArrow(
                    ctx, camera, body, body.force,
                    5 * options.arrowScale, "#a02c00", "F"
                );
            }
        }

        ctx.restore();
    }

    drawSeparateEnergyGraph(canvas, summary) {
        const width = canvas.getBoundingClientRect().width;
        const height = 180;

        if (width <= 0) return;

        const dpr = window.devicePixelRatio || 1;
        const pixelWidth = Math.max(1, Math.round(width * dpr));
        const pixelHeight = Math.max(1, Math.round(height * dpr));

        if (
            canvas.width !== pixelWidth ||
            canvas.height !== pixelHeight
        ) {
            canvas.width = pixelWidth;
            canvas.height = pixelHeight;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw in CSS pixels while retaining a sharp high-DPI buffer.
        ctx.setTransform(
            canvas.width / width, 0,
            0, canvas.height / height,
            0, 0
        );

        this.drawEnergyGraph(ctx, width, height);

        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];

        const text = last
            ? `Latest energy: ${last.energy.toFixed(6)} J at ` +
            `${last.time.toFixed(2)} s. ` +
            `Displayed interval: ${first.time.toFixed(1)}–` +
            `${last.time.toFixed(1)} s. Vertical axis auto-scales. ` +
            `Dragging, launching, and parameter changes can alter energy.`
            : "Waiting for energy samples.";

        if (summary.textContent !== text) {
            summary.textContent = text;
        }
    }

    drawEnergyGraph(ctx, canvasWidth, canvasHeight) {
        const x = 8;
        const y = 8;
        const width = canvasWidth - 16;
        const height = canvasHeight - 16;

        ctx.fillStyle = "rgba(255, 255, 255, 0.96)";
        ctx.fillRect(x, y, width, height);
        ctx.strokeStyle = "#555";
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, width, height);

        ctx.fillStyle = "#111";
        ctx.font = "14px sans-serif";
        ctx.fillText("Total mechanical energy E (J)", x + 10, y + 19);

        if (this.samples.length < 2) {
            ctx.fillText("Collecting samples…", x + 10, y + 45);
            return;
        }

        const first = this.samples[0];
        const last = this.samples[this.samples.length - 1];
        const values = this.samples.map((sample) => sample.energy);

        const minimum = Math.min(...values);
        const maximum = Math.max(...values);
        const padding = Math.max(
            (maximum - minimum) * 0.1,
            Math.max(Math.abs(minimum), Math.abs(maximum)) * 0.001,
            0.001
        );

        const low = minimum - padding;
        const high = maximum + padding;

        const left = x + 85;
        const right = x + width - 12;
        const top = y + 35;
        const bottom = y + height - 35;

        ctx.font = "12px monospace";
        ctx.fillStyle = "#111";
        ctx.fillText(high.toFixed(3), x + 8, top + 4);
        ctx.fillText(low.toFixed(3), x + 8, bottom + 4);
        ctx.fillText(
            `${first.time.toFixed(1)}–${last.time.toFixed(1)} s; auto-scaled`,
            x + 10,
            y + height - 12
        );

        ctx.strokeStyle = "#333";
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(left, bottom);
        ctx.lineTo(right, bottom);
        ctx.stroke();

        ctx.strokeStyle = "#6a1b9a";
        ctx.lineWidth = 2;
        ctx.beginPath();

        this.samples.forEach((sample, index) => {
            const px = left +
                (sample.time - first.time) /
                (last.time - first.time) * (right - left);

            const py = bottom -
                (sample.energy - low) / (high - low) *
                (bottom - top);

            if (index === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
        });

        ctx.stroke();
    }
}