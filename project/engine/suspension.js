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
        this.tension = 0;

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

    angularAcceleration(theta) {
        return -this.g * Math.sin(theta) / this.length;
    }

    step(dt) {
        if (!Number.isFinite(dt) || dt <= 0) {
            throw new Error("Time step must be finite and positive.");
        }

        // Velocity Verlet applied to the angular coordinate.
        const a0 = this.angularAcceleration(this.theta);
        const halfOmega = this.omega + 0.5 * dt * a0;

        this.theta += dt * halfOmega;

        const a1 = this.angularAcceleration(this.theta);
        this.omega = halfOmega + 0.5 * dt * a1;

        this.time += dt;
        this.updateBodyState();
    }

    updateBodyState() {
        const s = Math.sin(this.theta);
        const c = Math.cos(this.theta);
        const body = this.load;

        body.pos.x = this.anchor.pos.x + this.length * s;
        body.pos.y = this.anchor.pos.y - this.length * c;

        body.vel.x = this.length * c * this.omega;
        body.vel.y = this.length * s * this.omega;

        this.tension = body.m * (
            this.length * this.omega * this.omega +
            this.g * c
        );

        // Net force = rope tension + gravity.
        body.force.x = -this.tension * s;
        body.force.y = this.tension * c - body.m * this.g;
    }

    potentialEnergy() {
        // Zero potential energy at the lowest point.
        return this.load.m * this.g * this.length *
            (1 - Math.cos(this.theta));
    }
}