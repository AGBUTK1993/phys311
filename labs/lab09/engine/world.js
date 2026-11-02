import { Vec2 } from "./vec2.js";
import { EulerCromer } from "./integrators.js";
import { resolveCollisions } from "./collisions.js";

export class World {
  constructor({
    integrator = new EulerCromer(),
    bounds = null,
    restitution = 1,
    collisionsEnabled = true
  } = {}) {
    this.bodies = [];
    this.forces = [];
    this.integrator = integrator;
    this.bounds = bounds;
    this.restitution = restitution;
    this.collisionsEnabled = collisionsEnabled;
    this.time = 0;
  }

  addBody(body) {
    this.bodies.push(body);
    return body;
  }

  addForce(force) {
    this.forces.push(force);
    return force;
  }

  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new Error("Time step must be finite and positive.");
    }

    // 1. Clear forces left over from the previous step.
    for (const body of this.bodies) {
      body.clearForce();
    }

    // 2. Accumulate all current force contributions.
    for (const force of this.forces) {
      force.apply(this);
    }

    // 3. Advance velocities and positions.
    this.integrator.step(this, dt);

    // 4. Resolve contacts when enabled.
    if (this.collisionsEnabled) {
      resolveCollisions(this);
    }

    // 5. Advance the simulation clock.
    this.time += dt;
  }

  kineticEnergy() {
    let energy = 0;
    for (const body of this.bodies) {
      if (body.isStatic) continue;
      energy += body.kineticEnergy();
    }
    return energy;
  }

  potentialEnergy() {
    let energy = 0;
    for (const force of this.forces) {
      if (typeof force.potentialEnergy === "function") {
        energy += force.potentialEnergy(this);
      }
    }
    return energy;
  }

  totalEnergy() {
    return this.kineticEnergy() + this.potentialEnergy();
  }

  totalMomentum() {
    const momentum = new Vec2();
    for (const body of this.bodies) {
      if (body.isStatic) continue;
      momentum.addScaled(body.vel, body.m);
    }
    return momentum;
  }
}