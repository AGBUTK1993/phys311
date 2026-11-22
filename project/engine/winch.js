import { SuspensionWorld } from "./suspension.js";

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

export class WinchWorld extends SuspensionWorld {
    constructor() {
        super();

        this.lengthTarget = this.length;
        this.lengthRate = 0;
        this.lengthAcceleration = 0;
        this.minLength = 0.8;
        this.maxLength = 4.5;

        // Gameplay setting, not a measured material strength.
        this.breakStrength = 35;

        this.ropeState = "taut";
        this.breakTime = null;
        this.lastCatchImpulse = 0;
        this.referenceLength = this.length;
    }

    updateBodyState() {
        if (this.ropeState && this.ropeState !== "taut") return;

        super.updateBodyState();

        const rate = this.lengthRate ?? 0;
        const acceleration = this.lengthAcceleration ?? 0;
        const s = Math.sin(this.theta);
        const c = Math.cos(this.theta);

        // Radial velocity from paying out or reeling in.
        this.load.vel.x += rate * s;
        this.load.vel.y -= rate * c;

        // Radial acceleration changes the required tension.
        this.tension -= this.load.m * acceleration;

        this.load.force.x += this.load.m * acceleration * s;
        this.load.force.y -= this.load.m * acceleration * c;
    }

    potentialEnergy() {
        // Fixed reference, even when length changes or the rope breaks.
        return this.load.m * this.g * (
            this.load.pos.y -
            this.referenceSupportY +
            (this.referenceLength ?? 3)
        );
    }

    checkRope() {
        if (this.tension > this.breakStrength) {
            this.ropeState = "broken";
            this.breakTime = this.time;
        } else if (this.tension <= 0) {
            this.ropeState = "slack";
        }

        if (this.ropeState !== "taut") {
            this.tension = 0;
            this.load.force.x = 0;
            this.load.force.y = -this.load.m * this.g;
        }
    }

    step(dt) {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error("Time step must be finite and positive.");
        }

        // Keep the original fixed-length conservative validation model.
        if (this.conservativeMode) return super.step(dt);

        const ax = clamp(
            2 * (this.supportTarget - this.anchor.pos.x) -
            3 * this.anchor.vel.x,
            -0.8,
            0.8
        );

        this.supportHeightTarget = clamp(
            this.supportHeightTarget,
            this.supportHeightMin,
            this.supportHeightMax
        );

        const ay = this.verticalEnabled
            ? clamp(
                2 * (this.supportHeightTarget - this.anchor.pos.y) -
                3 * this.anchor.vel.y,
                -0.8,
                0.8
            )
            : 0;

        this.supportAcceleration = ax;
        this.supportVerticalAcceleration = ay;

        this.lengthTarget = clamp(
            this.lengthTarget,
            this.minLength,
            this.maxLength
        );

        const desiredRate = clamp(
            2 * (this.lengthTarget - this.length),
            -0.5,
            0.5
        );

        const al = this.ropeState === "broken"
            ? 0
            : clamp(4 * (desiredRate - this.lengthRate), -1, 1);

        this.lengthAcceleration = al;

        if (this.ropeState === "taut") {
            this.updateBodyState();
            this.checkRope();
        }

        const l0 = this.length;
        const v0 = this.lengthRate;

        const lengthAt = t =>
            l0 + v0 * t + 0.5 * al * t * t;

        if (this.ropeState === "taut") {
            // Changing length contributes -2 Ldot omega / L.
            // RK4 integrates the angular motion over this small step.
            const f = (t, theta, omega) => [
                omega,
                (
                    -(this.g + ay) * Math.sin(theta) -
                    ax * Math.cos(theta) -
                    2 * (v0 + al * t) * omega
                ) / lengthAt(t) -
                this.dampingRate * omega
            ];

            const q = this.theta;
            const w = this.omega;

            const a = f(0, q, w);
            const b = f(
                dt / 2,
                q + dt * a[0] / 2,
                w + dt * a[1] / 2
            );
            const c = f(
                dt / 2,
                q + dt * b[0] / 2,
                w + dt * b[1] / 2
            );
            const d = f(
                dt,
                q + dt * c[0],
                w + dt * c[1]
            );

            this.theta += dt *
                (a[0] + 2 * b[0] + 2 * c[0] + d[0]) / 6;

            this.omega += dt *
                (a[1] + 2 * b[1] + 2 * c[1] + d[1]) / 6;
        } else {
            // Slack and broken ropes exert no force on the artifact.
            this.load.pos.x += this.load.vel.x * dt;
            this.load.pos.y +=
                this.load.vel.y * dt -
                0.5 * this.g * dt * dt;

            this.load.vel.y -= this.g * dt;
        }

        this.anchor.pos.x +=
            this.anchor.vel.x * dt + 0.5 * ax * dt * dt;
        this.anchor.pos.y +=
            this.anchor.vel.y * dt + 0.5 * ay * dt * dt;

        this.anchor.vel.x += ax * dt;
        this.anchor.vel.y += ay * dt;

        if (this.ropeState !== "broken") {
            this.length = clamp(
                lengthAt(dt),
                this.minLength,
                this.maxLength
            );

            this.lengthRate = v0 + al * dt;

            if (
                this.length === this.minLength ||
                this.length === this.maxLength
            ) {
                this.lengthRate = 0;
            }
        }

        this.time += dt;

        if (this.ropeState === "slack") {
            this.catchRope();
        }

        if (this.ropeState === "taut") {
            this.updateBodyState();
            this.checkRope();
        }
    }

    catchRope() {
        const dx = this.load.pos.x - this.anchor.pos.x;
        const dy = this.load.pos.y - this.anchor.pos.y;
        const distance = Math.hypot(dx, dy);

        if (distance < this.length || distance === 0) return;

        const nx = dx / distance;
        const ny = dy / distance;
        const vx = this.load.vel.x - this.anchor.vel.x;
        const vy = this.load.vel.y - this.anchor.vel.y;

        const outwardSpeed =
            vx * nx + vy * ny - this.lengthRate;

        if (outwardSpeed < 0) return;

        // Ideal inelastic catch, not a resolved elastic force peak.
        // Do not divide this impulse by dt to decide whether to break.
        this.lastCatchImpulse = this.load.m * outwardSpeed;

        this.theta = Math.atan2(nx, -ny);
        this.omega = (vx * (-ny) + vy * nx) / this.length;
        this.ropeState = "taut";
    }
}