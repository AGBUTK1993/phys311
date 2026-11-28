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

    // Rotational state in the 2D plane.
    // Positive angles and angular velocities are counterclockwise.
    this.angle = 0;
    this.angularVelocity = 0;
    this.angularAcceleration = 0;
    this.torque = 0;

    // Establish a default circular rigid-body model.
    // Existing suspension dynamics will not rotate this body yet.
    this.configureGeometry({
      type: "disk",
      radius: this.radius
    });
  }

  // Configure a rigid body's geometry and rotational inertia.
  // The inertia is calculated about its center of mass.
  configureGeometry(geometry) {
    let inertia;

    if (geometry?.type === "disk") {
      const radius = geometry.radius;

      if (!Number.isFinite(radius) || radius <= 0) {
        throw new Error("Disk radius must be positive.");
      }

      inertia = 0.5 * this.m * radius ** 2;
      this.radius = radius;

    } else if (geometry?.type === "rectangle") {
      const { width, height } = geometry;

      if (
        !Number.isFinite(width) || width <= 0 ||
        !Number.isFinite(height) || height <= 0
      ) {
        throw new Error(
          "Rectangle dimensions must be positive."
        );
      }

      inertia = this.m * (width ** 2 + height ** 2) / 12;

      // Bounding-circle radius for compatibility with
      // the existing circular collision approximation.
      this.radius = Math.hypot(width, height) / 2;

    } else {
      throw new Error("Unsupported rigid-body geometry.");
    }

    this.geometry = { ...geometry };
    this.inertia = inertia;

    // Static bodies have no rotational response.
    this.invInertia = this.isStatic ? 0 : 1 / inertia;
  }

  // Rotational energy, kept separate from translational energy
  // until the engine integrates rotational motion.
  rotationalKineticEnergy() {
    return 0.5 * this.inertia * this.angularVelocity ** 2;
  }

  angularMomentum() {
    return this.inertia * this.angularVelocity;
  }

  // Reset accumulated torque before a future rotation step.
  clearTorque() {
    this.torque = 0;
  }

  // Accumulate torque about the body's center of mass.
  // Positive torque produces counterclockwise acceleration.
  applyTorque(torque) {
    if (!Number.isFinite(torque)) {
      throw new Error("Torque must be finite.");
    }

    if (!this.isStatic) {
      this.torque += torque;
    }
  }

  // Apply a force at a specified point in world coordinates.
  //
  // force: { x, y } in newtons
  // point: { x, y } in metres
  //
  // The force contributes to translation and also produces
  // torque about the body's center of mass.
  applyForceAtPoint(force, point) {
    if (
      !force ||
      !point ||
      !Number.isFinite(force.x) ||
      !Number.isFinite(force.y) ||
      !Number.isFinite(point.x) ||
      !Number.isFinite(point.y)
    ) {
      throw new Error(
        "Force and application point must have finite coordinates."
      );
    }

    if (this.isStatic) return;

    // Net translational force.
    this.force.x += force.x;
    this.force.y += force.y;

    // Displacement from center of mass to application point.
    const rx = point.x - this.pos.x;
    const ry = point.y - this.pos.y;

    // 2D cross product: r × F.
    this.applyTorque(
      rx * force.y - ry * force.x
    );
  }

  // Convert an attachment point from body-local coordinates
  // into world coordinates.
  //
  // Local coordinates are measured relative to the body's
  // center of mass, and rotate with the body.
  localPointToWorld(localPoint) {
    if (
      !localPoint ||
      !Number.isFinite(localPoint.x) ||
      !Number.isFinite(localPoint.y)
    ) {
      throw new Error(
        "Local attachment coordinates must be finite."
      );
    }

    const cos = Math.cos(this.angle);
    const sin = Math.sin(this.angle);

    return new Vec2(
      this.pos.x +
      localPoint.x * cos -
      localPoint.y * sin,

      this.pos.y +
      localPoint.x * sin +
      localPoint.y * cos
    );
  }

  // Apply a world-space force at a body-local attachment.
  // This produces translation and torque about the center of mass.
  applyForceAtLocalPoint(force, localPoint) {
    const worldPoint = this.localPointToWorld(localPoint);

    this.applyForceAtPoint(force, worldPoint);
  }

  // Advance rotational state using semi-implicit Euler.
  // This is not yet connected to the suspension/world integrator.
  stepRotation(dt) {
    if (!Number.isFinite(dt) || dt <= 0) {
      throw new Error("Rotation timestep must be positive.");
    }

    if (this.isStatic) {
      this.angularAcceleration = 0;
      this.angularVelocity = 0;
      this.clearTorque();
      return;
    }

    this.angularAcceleration = this.torque * this.invInertia;

    // Angular velocity first, then orientation.
    this.angularVelocity += this.angularAcceleration * dt;
    this.angle += this.angularVelocity * dt;

    // Applied torques must be recalculated for the next step.
    this.clearTorque();
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