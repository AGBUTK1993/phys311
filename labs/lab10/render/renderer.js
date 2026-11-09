import { Spring } from "../engine/forces.js";

export class Renderer {
    constructor(canvas, camera) {
        this.canvas = canvas;
        this.ctx = canvas.getContext("2d");
        this.camera = camera;

        // Drawing history belongs to the renderer, not the physics engine.
        this.showTrails = false;
        this.trails = new Map();
        this.trailWorld = null;
        this.lastTrailTime = null;

        this.maxTrailPoints = 1500;
        this.trailInterval = 1 / 30;

        this.colors = [
            "#ff8200",
            "#1565c0",
            "#2e7d32",
            "#8e24aa",
            "#c62828",
        ];
    }

    recordTrails(world) {
        // A restart creates a new world, so discard the old trails.
        if (this.trailWorld !== world) {
            this.trails.clear();
            this.trailWorld = world;
            this.lastTrailTime = null;
        }

        if (!this.showTrails) return;

        // Do not repeatedly record the same position while paused.
        if (
            this.lastTrailTime !== null &&
            world.time - this.lastTrailTime < this.trailInterval
        ) {
            return;
        }

        for (const body of world.bodies) {
            if (!this.trails.has(body.id)) {
                this.trails.set(body.id, []);
            }

            const points = this.trails.get(body.id);

            // Copy coordinates rather than storing the changing position object.
            points.push({
                x: body.pos.x,
                y: body.pos.y,
            });

            if (points.length > this.maxTrailPoints) {
                points.shift();
            }
        }

        this.lastTrailTime = world.time;
    }

    draw(world) {
        const ctx = this.ctx;
        const camera = this.camera;

        this.recordTrails(world);

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        ctx.setTransform(
            this.canvas.width / this.canvas.logicalWidth, 0,
            0, this.canvas.height / this.canvas.logicalHeight,
            0, 0
        );

        // Draw the walls for scenes that have boundaries.
        if (world.bounds !== null) {
            const bounds = world.bounds;
            const topLeft = camera.toScreen({
                x: bounds.xMin,
                y: bounds.yMax,
            });

            ctx.strokeStyle = "#333";
            ctx.lineWidth = 2;

            ctx.strokeRect(
                topLeft.x,
                topLeft.y,
                (bounds.xMax - bounds.xMin) * camera.scale,
                (bounds.yMax - bounds.yMin) * camera.scale
            );
        }

        // Draw trails behind the bodies.
        if (this.showTrails) {
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.lineWidth = 1.5;

            world.bodies.forEach((body, index) => {
                const points = this.trails.get(body.id);
                if (!points || points.length < 2) return;

                ctx.strokeStyle = this.colors[index % this.colors.length];
                ctx.beginPath();

                points.forEach((point, pointIndex) => {
                    const screen = camera.toScreen(point);

                    if (pointIndex === 0) {
                        ctx.moveTo(screen.x, screen.y);
                    } else {
                        ctx.lineTo(screen.x, screen.y);
                    }
                });

                ctx.stroke();
            });

            ctx.restore();
        }

        // Draw spring connections behind the bodies.
        ctx.strokeStyle = "#777";
        ctx.lineWidth = 2;

        for (const force of world.forces) {
            if (!(force instanceof Spring)) continue;

            const start = camera.toScreen(force.a.pos);
            const end = camera.toScreen(force.b.pos);

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }

        // Draw the current body positions.
        world.bodies.forEach((body, index) => {
            const screen = camera.toScreen(body.pos);
            const radiusPixels = body.radius * camera.scale;

            ctx.beginPath();
            ctx.arc(screen.x, screen.y, radiusPixels, 0, 2 * Math.PI);

            ctx.fillStyle = body.isStatic
                ? "#666"
                : this.colors[index % this.colors.length];

            ctx.fill();

            ctx.strokeStyle = "#333";
            ctx.lineWidth = 1;
            ctx.stroke();

            if (body.name) {
                ctx.fillStyle = "#333";
                ctx.font = "14px Arial";
                ctx.fillText(
                    body.name,
                    screen.x + radiusPixels + 8,
                    screen.y + 5
                );
            }
        });
    }
}