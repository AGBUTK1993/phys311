import { World } from "./world.js";
import { Body } from "./body.js";
import { Vec2 } from "./vec2.js";
import { VelocityVerlet } from "./integrators.js";

// A fixed-support pendulum represented by its angle.
// Physics only: no canvas or HTML code belongs here.
export class SuspensionWorld extends World {
    constructor() {
        super({
            integrator: new VelocityVerlet(),
            collisionsEnabled: false,
        });

        this.g = 9.81;
        this.length = 3;
        this.theta = 0.2;
        this.omega = 0;
        // Suspension damping rate, in inverse seconds.
        // Set to zero for conservative validation.
        this.dampingRate = 0.35;
        this.conservativeMode = false;
        this.tension = 0;
        this.supportTarget = 0;
        this.supportAcceleration = 0;
        this.verticalEnabled = false;
        this.supportHeightTarget = 2;
        this.supportHeightMin = 1;
        this.supportHeightMax = 4.5;
        this.supportVerticalAcceleration = 0;
        this.referenceSupportY = 2;
        this.stoppedForSlack = false;

        this.anchor = this.addBody(new Body({
            pos: new Vec2(0, 2),
            radius: 0.12,
            isStatic: true,
            name: "Support",
        }));

        this.load = this.addBody(new Body({
            m: 2,
            radius: 0.22,
            pos: new Vec2(),
            vel: new Vec2(),
            name: "Suspended load",
        }));

        // Endpoints used by the renderer to draw the rope.
        this.rope = { a: this.anchor, b: this.load };

        this.updateBodyState();
    }

    angularAcceleration(theta, ax = 0, ay = 0) {
        return (
            -(this.g + ay) * Math.sin(theta) -
            ax * Math.cos(theta)
        ) / this.length;
    }

    step(dt) {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error("Time step must be finite and positive.");
        }

        if (this.stoppedForSlack) return;

        // Horizontal motor: acceleration-limited target tracking.
        const positionError =
            this.supportTarget - this.anchor.pos.x;

        const requestedAcceleration =
            2 * positionError - 3 * this.anchor.vel.x;

        const ax = this.conservativeMode
            ? 0
            : Math.max(-0.8, Math.min(0.8, requestedAcceleration));

        // Vertical motor uses the same smooth target tracking.
        this.supportHeightTarget = Math.max(
            this.supportHeightMin,
            Math.min(this.supportHeightMax, this.supportHeightTarget)
        );

        const heightError =
            this.supportHeightTarget - this.anchor.pos.y;

        const requestedVerticalAcceleration =
            2 * heightError - 3 * this.anchor.vel.y;

        const ay = this.conservativeMode || !this.verticalEnabled
            ? 0
            : Math.max(
                -0.8,
                Math.min(0.8, requestedVerticalAcceleration)
            );

        this.supportAcceleration = ax;
        this.supportVerticalAcceleration = ay;
        this.updateBodyState();

        if (this.tension <= 0) {
            this.stoppedForSlack = true;
            return;
        }

        const dampingFactor =
            Math.exp(-0.5 * this.dampingRate * dt);

        this.omega *= dampingFactor;

        // Hold motor acceleration constant during this small step.
        const a0 = this.angularAcceleration(this.theta, ax, ay);
        const halfOmega = this.omega + 0.5 * dt * a0;

        this.anchor.pos.x +=
            this.anchor.vel.x * dt + 0.5 * ax * dt * dt;
        this.anchor.vel.x += ax * dt;

        this.anchor.pos.y +=
            this.anchor.vel.y * dt + 0.5 * ay * dt * dt;
        this.anchor.vel.y += ay * dt;

        this.theta += dt * halfOmega;

        const a1 = this.angularAcceleration(this.theta, ax, ay);
        this.omega = halfOmega + 0.5 * dt * a1;
        this.omega *= dampingFactor;

        this.time += dt;
        this.updateBodyState();

        if (this.tension <= 0) {
            this.stoppedForSlack = true;
        }
    }

    updateBodyState() {
        const s = Math.sin(this.theta);
        const c = Math.cos(this.theta);
        const body = this.load;

        body.pos.x = this.anchor.pos.x + this.length * s;
        body.pos.y = this.anchor.pos.y - this.length * c;

        body.vel.x =
            this.anchor.vel.x + this.length * c * this.omega;
        body.vel.y =
            this.anchor.vel.y + this.length * s * this.omega;

        this.tension = body.m * (
            this.length * this.omega * this.omega +
            (this.g + this.supportVerticalAcceleration) * c -
            this.supportAcceleration * s
        );

        // Equivalent tangential force from suspension damping.
        const dampingForce =
            -body.m * this.length * this.dampingRate * this.omega;

        body.force.x = -this.tension * s + dampingForce * c;
        body.force.y =
            this.tension * c - body.m * this.g + dampingForce * s;
    }

    potentialEnergy() {
        // Keep a fixed energy reference as the support rises or falls.
        return this.load.m * this.g * this.length *
            (1 - Math.cos(this.theta)) +
            this.load.m * this.g *
            (this.anchor.pos.y - this.referenceSupportY);
    }
}