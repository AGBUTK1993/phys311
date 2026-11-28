
/*
 * Phase 5E.4.8 — Rectangle/pedestal top geometry.
 *
 * Detects:
 * - Rectangle vertices touching the pedestal top
 * - Lower-edge support over a narrow pedestal
 * - Tilted lower-edge contact
 *
 * Read-only: no forces, impulses or integration.
 *
 * Limitations:
 * - Stationary, one-sided horizontal top surface
 * - At most two support points intended for solver
 * - No side-wall collisions or edge-edge normals
 * - No continuous collision detection
 * - Not a complete polygon collision manifold
 */

export function sampleRectanglePedestalContacts(
    body,
    pedestal,
    { tolerance = 1e-8 } = {}
) {
    const geometry = body?.geometry;

    if (
        geometry?.type !== "rectangle" ||
        !Number.isFinite(geometry.width) ||
        !Number.isFinite(geometry.height) ||
        geometry.width <= 0 ||
        geometry.height <= 0 ||
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.angle) ||
        !Number.isFinite(body?.vel?.x) ||
        !Number.isFinite(body?.vel?.y) ||
        !Number.isFinite(body?.angularVelocity) ||
        !Number.isFinite(pedestal?.xMin) ||
        !Number.isFinite(pedestal?.xMax) ||
        !Number.isFinite(pedestal?.topY) ||
        pedestal.xMin >= pedestal.xMax ||
        !Number.isFinite(tolerance) ||
        tolerance < 0
    ) {
        throw new Error(
            "Invalid rectangle contact geometry."
        );
    }

    // Preserve the original one-sided constraint.
    if (body.pos.y < pedestal.topY) {
        return Object.freeze([]);
    }

    const hw = geometry.width / 2;
    const hh = geometry.height / 2;

    const c = Math.cos(body.angle);
    const s = Math.sin(body.angle);

    function worldPoint(localX, localY) {
        return {
            x: body.pos.x + localX * c - localY * s,
            y: body.pos.y + localX * s + localY * c
        };
    }

    const vertices = [
        {
            id: "bottom-left",
            point: worldPoint(-hw, -hh)
        },
        {
            id: "bottom-right",
            point: worldPoint(hw, -hh)
        },
        {
            id: "top-left",
            point: worldPoint(-hw, hh)
        },
        {
            id: "top-right",
            point: worldPoint(hw, hh)
        }
    ];

    const candidates = [];

    function addCandidate(id, point) {
        if (
            point.x < pedestal.xMin - tolerance ||
            point.x > pedestal.xMax + tolerance
        ) {
            return;
        }

        const separation = point.y - pedestal.topY;

        if (separation > tolerance) {
            return;
        }

        // Avoid counting the same location twice
        // when an edge endpoint is also a vertex.
        if (candidates.some(existing =>
            Math.hypot(
                existing.point.x - point.x,
                existing.point.y - point.y
            ) <= Math.max(tolerance, 1e-10)
        )) {
            return;
        }

        const rx = point.x - body.pos.x;
        const ry = point.y - body.pos.y;

        candidates.push({
            vertexId: id,

            point: Object.freeze({
                x: point.x,
                y: point.y
            }),

            surfacePoint: Object.freeze({
                x: Math.max(
                    pedestal.xMin,
                    Math.min(point.x, pedestal.xMax)
                ),
                y: pedestal.topY
            }),

            normal: Object.freeze({ x: 0, y: 1 }),

            separation,
            penetration: Math.max(0, -separation),

            normalSpeed:
                body.vel.y +
                body.angularVelocity * rx
        });
    }

    // Original vertex-contact detection.
    for (const vertex of vertices) {
        addCandidate(vertex.id, vertex.point);
    }

    // New: find where the lower edge overlaps the
    // pedestal's finite horizontal x interval.
    const left = vertices[0].point;
    const right = vertices[1].point;

    const dx = right.x - left.x;

    if (Math.abs(dx) > 1e-12) {
        const edgeMinX = Math.min(left.x, right.x);
        const edgeMaxX = Math.max(left.x, right.x);

        const overlapMinX = Math.max(
            edgeMinX,
            pedestal.xMin
        );

        const overlapMaxX = Math.min(
            edgeMaxX,
            pedestal.xMax
        );

        if (
            overlapMaxX >= overlapMinX - tolerance
        ) {
            const endpoints = [
                {
                    id: "bottom-edge-left",
                    x: overlapMinX
                },
                {
                    id: "bottom-edge-right",
                    x: overlapMaxX
                }
            ];

            for (const endpoint of endpoints) {
                const t = Math.max(
                    0,
                    Math.min(
                        1,
                        (endpoint.x - left.x) / dx
                    )
                );

                const point = {
                    x: left.x + t * dx,
                    y: left.y +
                        t * (right.y - left.y)
                };

                addCandidate(endpoint.id, point);
            }
        }
    }

    candidates.sort(
        (a, b) =>
            a.separation - b.separation ||
            a.point.x - b.point.x
    );

    return Object.freeze(
        candidates.map(contact =>
            Object.freeze(contact)
        )
    );
}
