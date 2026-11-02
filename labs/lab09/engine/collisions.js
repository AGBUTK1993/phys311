// Keep a moving circle inside rectangular boundaries.
export function resolveWalls(body, bounds, e) {
  if (body.isStatic) return;

  const r = body.radius;

  if (body.pos.x - r < bounds.xMin) {
    body.pos.x = bounds.xMin + r;
    if (body.vel.x < 0) body.vel.x *= -e;
  }

  if (body.pos.x + r > bounds.xMax) {
    body.pos.x = bounds.xMax - r;
    if (body.vel.x > 0) body.vel.x *= -e;
  }

  if (body.pos.y - r < bounds.yMin) {
    body.pos.y = bounds.yMin + r;
    if (body.vel.y < 0) body.vel.y *= -e;
  }

  if (body.pos.y + r > bounds.yMax) {
    body.pos.y = bounds.yMax - r;
    if (body.vel.y > 0) body.vel.y *= -e;
  }
}

// Resolve an overlapping pair. Return true if an impulse was applied.
export function resolvePair(a, b, e = 1) {
  const dx = b.pos.x - a.pos.x;
  const dy = b.pos.y - a.pos.y;
  const radiusSum = a.radius + b.radius;
  const distanceSquared = dx * dx + dy * dy;

  if (distanceSquared >= radiusSum * radiusSum) return false;

  const inverseMassSum = a.invMass + b.invMass;
  if (inverseMassSum === 0) return false;

  const distance = Math.sqrt(distanceSquared);

  // The normal points from a toward b.
  // Coincident centers need a fallback direction.
  const nx = distance > 0 ? dx / distance : 1;
  const ny = distance > 0 ? dy / distance : 0;

  // 1. Remove overlap, moving lighter bodies farther.
  const overlap = radiusSum - distance;
  const correctionA = overlap * a.invMass / inverseMassSum;
  const correctionB = overlap * b.invMass / inverseMassSum;

  a.pos.x -= nx * correctionA;
  a.pos.y -= ny * correctionA;
  b.pos.x += nx * correctionB;
  b.pos.y += ny * correctionB;

  // 2. Measure relative velocity along the collision normal.
  const relativeVX = b.vel.x - a.vel.x;
  const relativeVY = b.vel.y - a.vel.y;
  const vn = relativeVX * nx + relativeVY * ny;

  // Separating guard: do not bounce bodies already moving apart.
  if (vn > 0) return false;

  // Zero normal relative speed needs no impulse.
  if (vn === 0) return false;

  // 3. Apply equal-and-opposite impulses.
  const impulse = -(1 + e) * vn / inverseMassSum;

  a.vel.x -= impulse * nx * a.invMass;
  a.vel.y -= impulse * ny * a.invMass;
  b.vel.x += impulse * nx * b.invMass;
  b.vel.y += impulse * ny * b.invMass;

  return true;
}

// Connect collision handling to World.step().
export function resolveCollisions(world) {
  const bodies = world.bodies;
  const e = world.restitution;

  if (!Number.isFinite(e) || e < 0 || e > 1) {
    throw new Error("Restitution must be between 0 and 1.");
  }

  if (world.bounds !== null) {
    for (const body of bodies) {
      resolveWalls(body, world.bounds, e);
    }
  }

  // Check each distinct pair once.
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      resolvePair(bodies[i], bodies[j], e);
    }
  }

  // Pair corrections may have pushed a body across a boundary.
  if (world.bounds !== null) {
    for (const body of bodies) {
      resolveWalls(body, world.bounds, e);
    }
  }
}