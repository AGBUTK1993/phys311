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

    drawChamberBackdrop() {
        const ctx = this.ctx;
        const w = this.canvas.logicalWidth;
        const h = this.canvas.logicalHeight;

        ctx.save();

        // Painted rear wall: scenery, not collision geometry.
        const stone = ctx.createLinearGradient(0, 0, 0, h);
        stone.addColorStop(0, "#c9ad78");
        stone.addColorStop(1, "#ead9b3");
        ctx.fillStyle = stone;
        ctx.fillRect(0, 0, w, h);

        // Staggered sandstone masonry.
        ctx.strokeStyle = "rgba(92, 67, 37, 0.16)";
        ctx.lineWidth = 2;

        const camera = this.camera;
        const topLeft = camera.toWorld({ x: 0, y: 0 });
        const bottomRight = camera.toWorld({ x: w, y: h });
        const brickWidth = 2;
        const brickHeight = 1;

        for (
            let row = Math.floor(bottomRight.y / brickHeight);
            row <= Math.ceil(topLeft.y / brickHeight);
            row++
        ) {
            const y = row * brickHeight;
            const screenY = camera.toScreen({ x: 0, y }).y;
            const nextY = camera.toScreen({
                x: 0,
                y: y + brickHeight,
            }).y;

            ctx.beginPath();
            ctx.moveTo(0, screenY);
            ctx.lineTo(w, screenY);

            const offset = (Math.abs(row) % 2) * brickWidth / 2;
            const first = Math.floor(
                (topLeft.x - offset) / brickWidth
            );
            const last = Math.ceil(
                (bottomRight.x - offset) / brickWidth
            );

            for (let col = first; col <= last; col++) {
                const x = col * brickWidth + offset;
                const screenX = camera.toScreen({ x, y }).x;
                ctx.moveTo(screenX, screenY);
                ctx.lineTo(screenX, nextY);
            }

            ctx.stroke();
        }

        // Match the HTML toolbar's reserved screen space.
        const banner = this.canvas.closest(".game-area")
            ?.querySelector(".game-banner-size");

        const bannerPixels =
            banner?.getBoundingClientRect().height || 0;

        const screenScale =
            h / this.canvas.getBoundingClientRect().height;

        const bandHeight = bannerPixels
            ? bannerPixels * screenScale
            : 92;

        const headerTop = bannerPixels
            ? parseFloat(getComputedStyle(banner).paddingTop)
            : 0;

        const narrow = window.matchMedia(
            "(max-width: 700px)"
        ).matches;

        // Decorative painted bands.
        ctx.fillStyle = "#294d50";
        ctx.fillRect(0, 0, w, bandHeight);
        ctx.fillRect(0, h - 24, w, 24);

        ctx.fillStyle = "#c49a50";
        ctx.fillRect(0, bandHeight - 2, w, 4);
        ctx.fillRect(0, h - 27, w, 3);

        // Stylized winged solar motif, not a written inscription.
        ctx.save();
        ctx.translate(
            w / 2,
            bannerPixels
                ? (headerTop + (narrow ? 16 : 22)) * screenScale
                : 45
        );

        if (bannerPixels) {
            ctx.scale(0.45 * screenScale, 0.45 * screenScale);
        }
        ctx.strokeStyle = "#d6b56e";
        ctx.lineWidth = 3;

        for (const side of [-1, 1]) {
            for (let feather = 0; feather < 6; feather++) {
                ctx.beginPath();
                ctx.moveTo(side * 23, 0);
                ctx.lineTo(
                    side * (65 + feather * 15),
                    -15 + feather * 6
                );
                ctx.stroke();
            }
        }

        ctx.fillStyle = "#d6b56e";
        ctx.beginPath();
        ctx.arc(0, 0, 20, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#a95132";
        ctx.beginPath();
        ctx.arc(0, 0, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.restore();
    }

    drawArtifact(body) {
        const ctx = this.ctx;
        const screen = this.camera.toScreen(body.pos);
        const r = body.radius * this.camera.scale;

        ctx.save();
        ctx.translate(screen.x, screen.y);
        ctx.scale(r, r);

        // The circular cradle matches the radius used by delivery detection.
        ctx.beginPath();
        ctx.arc(0, 0, 1, 0, Math.PI * 2);
        ctx.fillStyle = "#25474c";
        ctx.fill();
        ctx.strokeStyle = "#b89555";
        ctx.lineWidth = 0.09;
        ctx.stroke();

        // Keep all mask artwork inside the physical footprint.
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, 0.94, 0, Math.PI * 2);
        ctx.clip();

        // Stylized gold-and-blue headdress.
        ctx.beginPath();
        ctx.moveTo(-0.36, -0.75);
        ctx.quadraticCurveTo(0, -1.02, 0.36, -0.75);
        ctx.lineTo(0.82, 0.68);
        ctx.lineTo(0.28, 0.81);
        ctx.lineTo(0, 0.47);
        ctx.lineTo(-0.28, 0.81);
        ctx.lineTo(-0.82, 0.68);
        ctx.closePath();
        ctx.fillStyle = "#d8ad51";
        ctx.fill();

        ctx.strokeStyle = "#244a78";
        ctx.lineWidth = 0.10;

        for (const side of [-1, 1]) {
            for (let i = 0; i < 5; i++) {
                const y = -0.35 + i * 0.22;
                ctx.beginPath();
                ctx.moveTo(side * 0.37, y);
                ctx.lineTo(side * (0.49 + i * 0.065), y + 0.10);
                ctx.stroke();
            }
        }

        // Face.
        ctx.beginPath();
        ctx.ellipse(0, -0.08, 0.36, 0.53, 0, 0, Math.PI * 2);
        ctx.fillStyle = "#f0cb73";
        ctx.fill();

        // Brows and eyes.
        ctx.strokeStyle = "#28333c";
        ctx.lineWidth = 0.055;

        for (const side of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(side * 0.07, -0.28);
            ctx.lineTo(side * 0.27, -0.30);
            ctx.moveTo(side * 0.08, -0.16);
            ctx.lineTo(side * 0.27, -0.14);
            ctx.stroke();
        }

        // Nose and mouth.
        ctx.strokeStyle = "#9a652c";
        ctx.lineWidth = 0.04;
        ctx.beginPath();
        ctx.moveTo(0, -0.12);
        ctx.lineTo(-0.04, 0.10);
        ctx.lineTo(0.04, 0.10);
        ctx.moveTo(-0.12, 0.23);
        ctx.quadraticCurveTo(0, 0.28, 0.12, 0.23);
        ctx.stroke();

        // Ceremonial beard.
        ctx.fillStyle = "#244a78";
        ctx.beginPath();
        ctx.moveTo(-0.09, 0.39);
        ctx.lineTo(0.09, 0.39);
        ctx.lineTo(0.06, 0.76);
        ctx.lineTo(-0.06, 0.76);
        ctx.closePath();
        ctx.fill();

        ctx.restore();
        ctx.restore();
    }

    drawSuspensionRig(world) {
        const ctx = this.ctx;
        const camera = this.camera;

        // Rail endpoints match the support slider's travel range.
        const left = camera.toScreen({
            x: -3,
            y: world.anchor.pos.y,
        });

        const right = camera.toScreen({
            x: 3,
            y: world.anchor.pos.y,
        });

        const support = camera.toScreen(world.anchor.pos);
        const target = camera.toScreen({
            x: world.supportTarget,
            y: world.anchor.pos.y,
        });

        const unit = camera.scale;
        const railY = support.y - 0.28 * unit;

        ctx.save();

        // Vertical guide posts for the moving crossbeam.
        if (world.verticalEnabled) {
            ctx.strokeStyle = "#526467";
            ctx.lineWidth = 0.12 * unit;

            for (const x of [-3.3, 3.3]) {
                const top = camera.toScreen({
                    x,
                    y: world.supportHeightMax + 0.5,
                });

                const bottom = camera.toScreen({
                    x,
                    y: world.supportHeightMin,
                });

                ctx.beginPath();
                ctx.moveTo(top.x, top.y);
                ctx.lineTo(bottom.x, bottom.y);
                ctx.stroke();
            }
        }

        // Modern recovery equipment against the chamber backdrop.
        ctx.fillStyle = "#36464b";
        ctx.fillRect(
            left.x - 0.18 * unit,
            railY - 0.10 * unit,
            right.x - left.x + 0.36 * unit,
            0.20 * unit
        );

        ctx.strokeStyle = "#b8c2be";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(left.x, railY);
        ctx.lineTo(right.x, railY);
        ctx.stroke();

        // End stops.
        ctx.fillStyle = "#9b783c";
        for (const x of [left.x, right.x]) {
            ctx.fillRect(
                x - 0.08 * unit,
                railY - 0.20 * unit,
                0.16 * unit,
                0.40 * unit
            );
        }

        // Requested position marker.
        if (!world.conservativeMode) {
            ctx.fillStyle = "#28656a";
            ctx.beginPath();
            ctx.moveTo(target.x, railY - 0.28 * unit);
            ctx.lineTo(target.x - 0.12 * unit, railY - 0.48 * unit);
            ctx.lineTo(target.x + 0.12 * unit, railY - 0.48 * unit);
            ctx.closePath();
            ctx.fill();
        }

        // Carriage follows the actual support, not the target.
        ctx.fillStyle = "#bd9148";
        ctx.strokeStyle = "#493b27";
        ctx.lineWidth = 2;

        ctx.fillRect(
            support.x - 0.23 * unit,
            railY - 0.16 * unit,
            0.46 * unit,
            0.32 * unit
        );

        ctx.strokeRect(
            support.x - 0.23 * unit,
            railY - 0.16 * unit,
            0.46 * unit,
            0.32 * unit
        );

        // Hanger joins the carriage to the physical rope endpoint.
        ctx.beginPath();
        ctx.moveTo(support.x, railY + 0.16 * unit);
        ctx.lineTo(support.x, support.y);
        ctx.stroke();

        ctx.restore();
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
        if (world.rope) {
            this.drawChamberBackdrop();
        }

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

        // Delivery zone: a target region, not a physical wall.
        if (world.delivery) {
            const goal = world.delivery;
            const z = goal.zone;
            const corner = camera.toScreen({
                x: z.xMin,
                y: z.yMax,
            });

            const width = (z.xMax - z.xMin) * camera.scale;
            const height = (z.yMax - z.yMin) * camera.scale;

            ctx.save();
            ctx.fillStyle = goal.won
                ? "rgba(46, 125, 50, 0.35)"
                : "rgba(46, 125, 50, 0.12)";
            ctx.strokeStyle = "#2e7d32";
            ctx.lineWidth = 2;

            ctx.fillRect(corner.x, corner.y, width, height);
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(corner.x, corner.y, width, height);
            ctx.setLineDash([]);

            ctx.fillStyle = "#205b25";
            ctx.font = "14px Arial";
            ctx.fillText(
                goal.won ? "Delivered!" : "Delivery zone",
                corner.x,
                corner.y - 10
            );

            const progress = goal.heldTime / goal.requiredTime;
            ctx.fillRect(
                corner.x,
                corner.y + height + 6,
                width * progress,
                5
            );
            if (goal.won) {
                ctx.fillStyle = "#205b25";
                ctx.font = "bold 16px Arial";
                ctx.textAlign = "center";
                ctx.fillText(
                    "DONE!",
                    corner.x + width / 2,
                    corner.y + height + 32
                );
            }
            ctx.restore();
        }

        // Draw the suspension rope behind its endpoints.
        if (world.rope) {
            this.drawSuspensionRig(world);
            const start = camera.toScreen(world.rope.a.pos);
            const end = camera.toScreen(world.rope.b.pos);

            ctx.save();
            ctx.strokeStyle = "#76552b";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            ctx.restore();
        }

        // Draw the current body positions.
        world.bodies.forEach((body, index) => {
            const screen = camera.toScreen(body.pos);
            const radiusPixels = body.radius * camera.scale;
            if (world.rope && body === world.load) {
                this.drawArtifact(body);

                ctx.fillStyle = "#30271c";
                ctx.font = "14px Arial";
                ctx.fillText(
                    "Death mask",
                    screen.x + radiusPixels + 8,
                    screen.y + 5
                );

                return; // Skip the ordinary circle for this body only.
            }

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