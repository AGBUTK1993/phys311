"use strict";

import { Vec2 } from "./vec2.js";

// Store one object's physical properties in SI units.
class Body {
  constructor({
    m = 1,
    pos = new Vec2(),
    vel = new Vec2(),
    radius = 0.3
  } = {}) {
    if (!Number.isFinite(m) || m <= 0) {
      throw new Error("Body mass must be a positive, finite number.");
    }

    this.m = m;
    this.pos = pos.clone();
    this.vel = vel.clone();
    this.acc = new Vec2();
    this.force = new Vec2();
    this.radius = radius;
  }

  // Reset the accumulated force before calculating new forces.
  clearForce() {
    this.force.set(0, 0);
  }

  // Translational kinetic energy: K = (1/2) m |v|^2.
  kineticEnergy() {
    return 0.5 * this.m * this.vel.lengthSq();
  }
}

export { Body };