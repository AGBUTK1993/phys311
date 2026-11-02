// Uniform downward gravity: Fy = -m*g.
export class Gravity {
  constructor(g = 9.81) {
    this.g = g;
  }

  apply(world) {
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      b.force.y -= b.m * this.g;
    }
  }

  potentialEnergy(world) {
    let energy = 0;
    for (const b of world.bodies) {
      if (b.isStatic) continue;
      energy += b.m * this.g * b.pos.y;
    }
    return energy;
  }
}

// A spring connecting bodies a and b.
export class Spring {
  constructor(a, b, k = 10, restLength = 1) {
    this.a = a;
    this.b = b;
    this.k = k;
    this.restLength = restLength;
  }

  apply(world) {
    const dx = this.b.pos.x - this.a.pos.x;
    const dy = this.b.pos.y - this.a.pos.y;
    const distance = Math.hypot(dx, dy);

    // At zero separation, the spring direction is undefined.
    if (distance === 0) return;

    const extension = distance - this.restLength;
    const scale = this.k * extension / distance;
    const fx = scale * dx;
    const fy = scale * dy;

    this.a.force.x += fx;
    this.a.force.y += fy;
    this.b.force.x -= fx;
    this.b.force.y -= fy;
  }

  potentialEnergy(world) {
    const dx = this.b.pos.x - this.a.pos.x;
    const dy = this.b.pos.y - this.a.pos.y;
    const extension = Math.hypot(dx, dy) - this.restLength;
    return 0.5 * this.k * extension ** 2;
  }
}

// Mutual gravitational attraction with softened close encounters.
export class NewtonGravity {
  constructor(G = 1, softening = 0.05) {
    if (!Number.isFinite(G) || G <= 0) {
      throw new Error("G must be finite and positive.");
    }
    if (!Number.isFinite(softening) || softening <= 0) {
      throw new Error("Softening must be finite and positive.");
    }
    this.G = G;
    this.softening = softening;
  }

  apply(world) {
    const bodies = world.bodies;

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const r2 = dx * dx + dy * dy + this.softening ** 2;

        const scale = this.G * a.m * b.m /
          (r2 * Math.sqrt(r2));

        const fx = scale * dx;
        const fy = scale * dy;

        a.force.x += fx;
        a.force.y += fy;
        b.force.x -= fx;
        b.force.y -= fy;
      }
    }
  }

  potentialEnergy(world) {
    const bodies = world.bodies;
    let energy = 0;

    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i];
        const b = bodies[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const distance = Math.sqrt(
          dx * dx + dy * dy + this.softening ** 2
        );

        energy -= this.G * a.m * b.m / distance;
      }
    }
    return energy;
  }
}