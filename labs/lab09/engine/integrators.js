// Update velocity first, then position.
export class EulerCromer {
  step(world, dt) {
    for (const b of world.bodies) {
      if (b.isStatic) continue;

      b.acc.set(
        b.force.x * b.invMass,
        b.force.y * b.invMass
      );

      b.vel.addScaled(b.acc, dt);
      b.pos.addScaled(b.vel, dt);
    }
  }
}

// Half velocity update, full position update, half velocity update.
export class VelocityVerlet {
  step(world, dt) {
    for (const b of world.bodies) {
      if (b.isStatic) continue;

      b.acc.set(
        b.force.x * b.invMass,
        b.force.y * b.invMass
      );

      b.vel.addScaled(b.acc, 0.5 * dt);
      b.pos.addScaled(b.vel, dt);
    }

    // All bodies have moved. Recalculate forces at their new positions.
    for (const b of world.bodies) {
      b.clearForce();
    }
    for (const force of world.forces) {
      force.apply(world);
    }

    for (const b of world.bodies) {
      if (b.isStatic) continue;

      b.acc.set(
        b.force.x * b.invMass,
        b.force.y * b.invMass
      );

      b.vel.addScaled(b.acc, 0.5 * dt);
    }
  }
}