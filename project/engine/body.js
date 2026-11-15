import { Vec2 } from "./vec2.js";

let nextBodyId = 0;

// Store one circular body's physical properties and current state.
export class Body {
  constructor({
    m = 1,
    pos = new Vec2(),
    vel = new Vec2(),
    radius = 0.2,
    isStatic = false,
    name = "Body"
  } = {}) {
    if (!Number.isFinite(m) || m <= 0) {
      throw new Error("Body mass must be finite and positive.");
    }
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new Error("Body radius must be finite and positive.");
    }

    this.id = nextBodyId++;
    this.name = name;
    this.m = m;
    this.radius = radius;
    this.isStatic = isStatic;
    this.invMass = isStatic ? 0 : 1 / m;

    // Copies prevent bodies from accidentally sharing mutable vectors.
    this.pos = pos.clone();
    this.vel = isStatic ? new Vec2() : vel.clone();
    this.acc = new Vec2();
    this.force = new Vec2();
  }

  // Clear the accumulated force before calculating the next step.
  clearForce() {
    this.force.set(0, 0);
  }

  kineticEnergy() {
    return 0.5 * this.m *
      (this.vel.x ** 2 + this.vel.y ** 2);
  }

  momentum() {
    return new Vec2(
      this.m * this.vel.x,
      this.m * this.vel.y
    );
  }
}