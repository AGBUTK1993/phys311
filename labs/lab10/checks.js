import { Vec2 } from "./engine/vec2.js";
import { Body } from "./engine/body.js";
import { Gravity, Spring, NewtonGravity } from "./engine/forces.js";
import { EulerCromer, VelocityVerlet } from "./engine/integrators.js";
import { World } from "./engine/world.js";
import { resolvePair, resolveWalls } from "./engine/collisions.js";

// A moving body: mass 2 kg and velocity (3, 4) m/s.
const initialPosition = new Vec2(1, 2);

const ball = new Body({
  m: 2,
  pos: initialPosition,
  vel: new Vec2(3, 4),
  radius: 0.3,
  name: "Test ball"
});

// A static body represents an immovable obstacle.
const obstacle = new Body({
  pos: new Vec2(5, 2),
  radius: 0.6,
  isStatic: true,
  name: "Obstacle"
});

// Changing the original vector should not move the ball.
initialPosition.x = 99;

// Forces must reset to zero between physics steps.
ball.force.set(10, -20);
ball.clearForce();

const momentum = ball.momentum();

const checks = {
  "Kinetic energy is 25 J": ball.kineticEnergy() === 25,
  "Momentum is (6, 8) kg m/s":
    momentum.x === 6 && momentum.y === 8,
  "Position is an independent copy": ball.pos.x === 1,
  "Force resets to zero":
    ball.force.x === 0 && ball.force.y === 0,
  "Static inverse mass is zero": obstacle.invMass === 0,
  "Body IDs are different": ball.id !== obstacle.id
};

console.table(checks);

const allPassed = Object.values(checks).every(
  passed => passed === true
);

console.assert(allPassed, "At least one Body check failed.");

document.getElementById("status").textContent = allPassed
  ? "Body checks passed: energy, momentum, copies, forces, static mass, and IDs."
  : "A Body check failed. See the console.";

console.log("Kinetic energy:", ball.kineticEnergy(), "J");
console.log("Momentum:", momentum, "kg m/s");

// Temporary world-shaped object for testing force calculations.
const a = new Body({
  m: 2,
  pos: new Vec2(0, 2)
});

const b = new Body({
  m: 3,
  pos: new Vec2(3, 2)
});

const testWorld = { bodies: [a, b] };

function resetTestForces() {
  for (const body of testWorld.bodies) {
    body.clearForce();
  }
}

// Floating-point calculations need a small comparison tolerance.
function closeEnough(actual, expected) {
  return Math.abs(actual - expected) < 1e-10;
}

// Uniform gravity: total potential energy = (2 + 3)*9.81*2.
const gravity = new Gravity(9.81);
resetTestForces();
gravity.apply(testWorld);

const gravityPassed =
  closeEnough(a.force.y, -19.62) &&
  closeEnough(b.force.y, -29.43) &&
  closeEnough(gravity.potentialEnergy(testWorld), 98.1);

// Spring: separation 3 m, rest length 1 m, stiffness 10 N/m.
const spring = new Spring(a, b, 10, 1);
resetTestForces();
spring.apply(testWorld);

const springPassed =
  closeEnough(a.force.x, 20) &&
  closeEnough(b.force.x, -20) &&
  closeEnough(spring.potentialEnergy(testWorld), 20);

// Softened gravity: G = 1 and softening = 0.1.
const attraction = new NewtonGravity(1, 0.1);
resetTestForces();
attraction.apply(testWorld);

const expectedForce = 18 / (9.01 ** 1.5);
const expectedPotential = -6 / Math.sqrt(9.01);

const attractionPassed =
  closeEnough(a.force.x, expectedForce) &&
  closeEnough(b.force.x, -expectedForce) &&
  closeEnough(a.force.y, 0) &&
  closeEnough(b.force.y, 0) &&
  closeEnough(
    attraction.potentialEnergy(testWorld),
    expectedPotential
  );

const forceChecks = {
  "Uniform gravity": gravityPassed,
  "Spring force and energy": springPassed,
  "Softened mutual gravity": attractionPassed
};

console.table(forceChecks);

const forcesPassed = Object.values(forceChecks).every(
  passed => passed === true
);

console.assert(forcesPassed, "At least one force check failed.");

document.getElementById("status").textContent =
  allPassed && forcesPassed
    ? "Body and force checks passed."
    : "A check failed. See the console.";

console.log(
  "Gravitational force on body a:",
  a.force.x.toFixed(6),
  "N"
);
console.log(
  "Gravitational potential energy:",
  attraction.potentialEnergy(testWorld).toFixed(6),
  "J"
);

// Check one time step against values calculated by hand.
function checkIntegrator(integrator, expectedY) {
  const fallingBody = new Body({
    m: 2,
    pos: new Vec2(0, 1),
    vel: new Vec2(0, 0)
  });

  const fixedBody = new Body({
    pos: new Vec2(5, 5),
    isStatic: true
  });

  const smallWorld = {
    bodies: [fallingBody, fixedBody],
    forces: [new Gravity(9.81)]
  };

  // Prepare the starting forces, as World.step() will do.
  for (const body of smallWorld.bodies) {
    body.clearForce();
  }
  for (const force of smallWorld.forces) {
    force.apply(smallWorld);
  }

  integrator.step(smallWorld, 0.1);

  const passed =
    closeEnough(fallingBody.pos.y, expectedY) &&
    closeEnough(fallingBody.vel.y, -0.981) &&
    closeEnough(fixedBody.pos.x, 5) &&
    closeEnough(fixedBody.pos.y, 5) &&
    closeEnough(fixedBody.vel.x, 0) &&
    closeEnough(fixedBody.vel.y, 0);

  return {
    method: integrator.constructor.name,
    y: fallingBody.pos.y.toFixed(5),
    vy: fallingBody.vel.y.toFixed(5),
    passed
  };
}

const integratorResults = [
  checkIntegrator(new EulerCromer(), 0.9019),
  checkIntegrator(new VelocityVerlet(), 0.95095)
];

console.table(integratorResults);

const integratorsPassed = integratorResults.every(
  result => result.passed
);

console.assert(integratorsPassed, "An integrator check failed.");

document.getElementById("status").textContent =
  allPassed && forcesPassed && integratorsPassed
    ? "Body, force, and integrator checks passed."
    : "A check failed. See the console.";

// Test the complete World update loop against analytical free fall.
const fallingWorld = new World({
  integrator: new VelocityVerlet(),
  collisionsEnabled: false
});

const fallingBall = fallingWorld.addBody(new Body({
  m: 2,
  pos: new Vec2(0, 10),
  vel: new Vec2(0, 0)
}));

fallingWorld.addForce(new Gravity(9.81));

const startingEnergy = fallingWorld.totalEnergy();

// Advance 100 steps of 0.01 s: one second of simulated motion.
for (let i = 0; i < 100; i++) {
  fallingWorld.step(0.01);
}

const finalMomentum = fallingWorld.totalMomentum();

const worldChecks = {
  "Time is 1 s": closeEnough(fallingWorld.time, 1),
  "Height is 5.095 m": closeEnough(fallingBall.pos.y, 5.095),
  "Vertical velocity is -9.81 m/s":
    closeEnough(fallingBall.vel.y, -9.81),
  "Mechanical energy is conserved":
    closeEnough(fallingWorld.totalEnergy(), startingEnergy),
  "Vertical momentum is -19.62 kg m/s":
    closeEnough(finalMomentum.y, -19.62)
};

console.table(worldChecks);

const worldPassed = Object.values(worldChecks).every(
  passed => passed === true
);

console.assert(worldPassed, "A World check failed.");

console.log("World time:", fallingWorld.time.toFixed(3), "s");
console.log("Height:", fallingBall.pos.y.toFixed(3), "m");
console.log(
  "Total energy:",
  fallingWorld.totalEnergy().toFixed(3),
  "J"
);

document.getElementById("status").textContent =
  allPassed && forcesPassed && integratorsPassed && worldPassed
    ? "All checks passed: bodies, forces, integrators, and World."
    : "A check failed. See the console.";    

// Unequal-mass elastic collision with a known analytical answer.
const collisionA = new Body({
  m: 2,
  pos: new Vec2(0, 0),
  vel: new Vec2(4, 0),
  radius: 1
});

const collisionB = new Body({
  m: 3,
  pos: new Vec2(1.9, 0),
  vel: new Vec2(0, 0),
  radius: 1
});

const pairEnergyBefore =
  collisionA.kineticEnergy() + collisionB.kineticEnergy();

const pairMomentumBefore =
  collisionA.m * collisionA.vel.x +
  collisionB.m * collisionB.vel.x;

const impulseApplied = resolvePair(collisionA, collisionB, 1);

const pairEnergyAfter =
  collisionA.kineticEnergy() + collisionB.kineticEnergy();

const pairMomentumAfter =
  collisionA.m * collisionA.vel.x +
  collisionB.m * collisionB.vel.x;

const finalSeparation = Math.hypot(
  collisionB.pos.x - collisionA.pos.x,
  collisionB.pos.y - collisionA.pos.y
);

// A separate wall test: moving left through the left boundary.
const wallBall = new Body({
  pos: new Vec2(0.1, 5),
  vel: new Vec2(-2, 0),
  radius: 0.5
});

resolveWalls(
  wallBall,
  { xMin: 0, xMax: 10, yMin: 0, yMax: 10 },
  0.8
);

const collisionChecks = {
  "Pair impulse applied": impulseApplied,
  "Body A final vx is -0.8":
    closeEnough(collisionA.vel.x, -0.8),
  "Body B final vx is 3.2":
    closeEnough(collisionB.vel.x, 3.2),
  "Pair momentum conserved":
    closeEnough(pairMomentumAfter, pairMomentumBefore),
  "Pair kinetic energy conserved":
    closeEnough(pairEnergyAfter, pairEnergyBefore),
  "Overlap removed":
    closeEnough(finalSeparation, 2),
  "Wall position corrected":
    closeEnough(wallBall.pos.x, 0.5),
  "Wall rebound vx is 1.6":
    closeEnough(wallBall.vel.x, 1.6)
};

console.table(collisionChecks);

const collisionsPassed = Object.values(collisionChecks).every(
  passed => passed === true
);

console.assert(collisionsPassed, "A collision check failed.");

console.log(
  "Collision velocities:",
  collisionA.vel.x.toFixed(3),
  collisionB.vel.x.toFixed(3),
  "m/s"
);
console.log("Pair momentum:", pairMomentumAfter.toFixed(3), "kg m/s");
console.log("Pair kinetic energy:", pairEnergyAfter.toFixed(3), "J");

document.getElementById("status").textContent =
  allPassed && forcesPassed && integratorsPassed &&
  worldPassed && collisionsPassed
    ? "All checks passed, including pair and wall collisions."
    : "A check failed. See the console.";

// Check an elastic impact against an immovable circular obstacle.
const staticTarget = new Body({
  pos: new Vec2(1.9, 0),
  radius: 1,
  isStatic: true
});

const incomingBall = new Body({
  m: 2,
  pos: new Vec2(0, 0),
  vel: new Vec2(3, 0),
  radius: 1
});

const staticImpactApplied = resolvePair(incomingBall, staticTarget, 1);

const staticCollisionPassed =
  staticImpactApplied &&
  closeEnough(incomingBall.vel.x, -3) &&
  closeEnough(incomingBall.kineticEnergy(), 9) &&
  staticTarget.pos.x === 1.9 &&
  staticTarget.pos.y === 0 &&
  staticTarget.vel.x === 0 &&
  staticTarget.vel.y === 0;

console.log("Static collision check passed:", staticCollisionPassed);
console.assert(staticCollisionPassed, "Static collision check failed.");

document.getElementById("status").textContent =
  allPassed && forcesPassed && integratorsPassed &&
  worldPassed && collisionsPassed && staticCollisionPassed
    ? "All checks passed, including static-obstacle collisions."
    : "A check failed. See the console.";

// Demonstrate why overlapping but separating bodies need a guard.
const separatingA = new Body({
  pos: new Vec2(0, 0),
  vel: new Vec2(-1, 0),
  radius: 0.5
});

const separatingB = new Body({
  pos: new Vec2(0.9, 0),
  vel: new Vec2(1, 0),
  radius: 0.5
});

const beforeA = separatingA.vel.x;
const beforeB = separatingB.vel.x;

const separatingImpulse = resolvePair(separatingA, separatingB, 1);

console.log("Separating-pair demonstration:");
console.table([
  {
    body: "A",
    beforeVX: beforeA,
    afterVX: separatingA.vel.x
  },
  {
    body: "B",
    beforeVX: beforeB,
    afterVX: separatingB.vel.x
  }
]);

console.log("Impulse applied to separating pair:", separatingImpulse);

const separatingGuardPassed =
  !separatingImpulse &&
  closeEnough(separatingA.vel.x, beforeA) &&
  closeEnough(separatingB.vel.x, beforeB);

console.log("Separating guard working:", separatingGuardPassed);