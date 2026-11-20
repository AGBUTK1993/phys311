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

    angularAcceleration(theta, supportAcceleration = 0) {
        return (
            -this.g * Math.sin(theta) -
            supportAcceleration * Math.cos(theta)
        ) / this.length;
    }

    step(dt) {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error("Time step must be finite and positive.");
        }

        if (this.stoppedForSlack) return;

        // A motor moves the support toward the requested position.
        // Acceleration is limited; position and velocity stay continuous.
        const positionError = this.supportTarget - this.anchor.pos.x;
        const requestedAcceleration =
            2 * positionError - 3 * this.anchor.vel.x;

        const ax = this.conservativeMode
            ? 0
            : Math.max(-0.8, Math.min(0.8, requestedAcceleration));

        this.supportAcceleration = ax;
        this.updateBodyState();

        if (this.tension <= 0) {
            this.stoppedForSlack = true;
            return;
        }

        // Apply half the damping before the Verlet update.
        const dampingFactor = Math.exp(-0.5 * this.dampingRate * dt);
        this.omega *= dampingFactor;
        // Treat the motor acceleration as constant during this small step.
        const a0 = this.angularAcceleration(this.theta, ax);
        const halfOmega = this.omega + 0.5 * dt * a0;

        this.anchor.pos.x +=
            this.anchor.vel.x * dt + 0.5 * ax * dt * dt;
        this.anchor.vel.x += ax * dt;

        this.theta += dt * halfOmega;

        const a1 = this.angularAcceleration(this.theta, ax);
        this.omega = halfOmega + 0.5 * dt * a1;
        // Apply the remaining half after the Verlet update.
        this.omega *= dampingFactor;

        this.time += dt;
        this.updateBodyState();

        // End the run when the taut-rope model ceases to apply.
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
        body.vel.y = this.length * s * this.omega;

        this.tension = body.m * (
            this.length * this.omega * this.omega +
            this.g * c -
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
        // Zero potential energy at the lowest point.
        return this.load.m * this.g * this.length *
            (1 - Math.cos(this.theta));
    }
}