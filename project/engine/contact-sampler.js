
/*
 * Phase 5E.3 — Disk-to-pedestal contact sampling.
 *
 * Reads real rigid-body position and velocity.
 * Produces signed separation and normal speed.
 *
 * Geometry only. Does not apply forces, impulses,
 * advance time, or modify the body.
 *
 * Current limitations:
 * - Disk above a horizontal pedestal.
 * - Top surface and upper corners only.
 * - No tunneling detection.
 * - No rotating-rectangle contact yet.
 */

export function sampleDiskPedestalContact(
    body,
    pedestal
) {
    if (
        body?.geometry?.type !== "disk" ||
        !Number.isFinite(body?.radius) ||
        body.radius <= 0 ||
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.vel?.x) ||
        !Number.isFinite(body?.vel?.y) ||
        !Number.isFinite(pedestal?.xMin) ||
        !Number.isFinite(pedestal?.xMax) ||
        !Number.isFinite(pedestal?.topY) ||
        pedestal.xMin >= pedestal.xMax
    ) {
        throw new Error(
            "Invalid disk or pedestal contact sample."
        );
    }

    // One-sided top-surface geometry.
    if (body.pos.y < pedestal.topY) {
        return null;
    }

    // Nearest point on the finite pedestal top.
    const nearestX = Math.max(
        pedestal.xMin,
        Math.min(body.pos.x, pedestal.xMax)
    );

    const dx = body.pos.x - nearestX;
    const dy = body.pos.y - pedestal.topY;
    const distance = Math.hypot(dx, dy);

    const normal = distance > 1e-14
        ? { x: dx / distance, y: dy / distance }
        : { x: 0, y: 1 };

    // Positive means gap; negative means overlap.
    const separation = distance - body.radius;

    // Relative speed toward or away from the
    // stationary pedestal along the contact normal.
    const normalSpeed =
        body.vel.x * normal.x +
        body.vel.y * normal.y;

    return Object.freeze({
        pedestalId: pedestal.id,
        separation,
        normalSpeed,
        normal: Object.freeze(normal),
        nearestPoint: Object.freeze({
            x: nearestX,
            y: pedestal.topY
        }),
        penetrating: separation < -1e-10
    });
}
