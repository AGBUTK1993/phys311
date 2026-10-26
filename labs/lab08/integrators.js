"use strict";

// Calculate each body's acceleration from its current net force.
function updateAccelerations(bodies, applyForces) {
  for (const body of bodies) {
    body.clearForce();
  }

  applyForces(bodies);

  for (const body of bodies) {
    body.acc.set(
      body.force.x / body.m,
      body.force.y / body.m
    );
  }
}

// Euler-Cromer: update velocity, then position.
function eulerCromer(bodies, dt, applyForces) {
  updateAccelerations(bodies, applyForces);

  for (const body of bodies) {
    body.vel.addScaled(body.acc, dt);
    body.pos.addScaled(body.vel, dt);
  }
}

// Velocity Verlet: half kick, drift, then another half kick.
function velocityVerlet(bodies, dt, applyForces) {
  updateAccelerations(bodies, applyForces);

  for (const body of bodies) {
    body.vel.addScaled(body.acc, 0.5 * dt);
    body.pos.addScaled(body.vel, dt);
  }

  // Recalculate acceleration after all positions have changed.
  updateAccelerations(bodies, applyForces);

  for (const body of bodies) {
    body.vel.addScaled(body.acc, 0.5 * dt);
  }
}

export { eulerCromer, velocityVerlet };