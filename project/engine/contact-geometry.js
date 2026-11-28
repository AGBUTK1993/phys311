
/*
 * Experimental contact geometry.
 *
 * Coordinates: x right, y up.
 *
 * Detects a circle against the upper face and
 * upper corners of a horizontal pedestal.
 *
 * Does not apply forces, impulses, or corrections.
 */

export function detectCirclePedestalContact(
    body,
    pedestal
) {
    if (
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.radius) ||
        body.radius <= 0 ||
        !Number.isFinite(pedestal?.xMin) ||
        !Number.isFinite(pedestal?.xMax) ||
        !Number.isFinite(pedestal?.topY) ||
        pedestal.xMax <= pedestal.xMin
    ) {
        throw new Error(
            "Invalid circle or pedestal contact geometry."
        );
    }

    // One-sided upper-surface detector.
    // A body whose center is below the top surface
    // belongs to a different collision case.
    if (body.pos.y < pedestal.topY) {
        return null;
    }

    // Closest point on the finite top segment.
    const contactX = Math.max(
        pedestal.xMin,
        Math.min(body.pos.x, pedestal.xMax)
    );

    const contactY = pedestal.topY;

    const dx = body.pos.x - contactX;
    const dy = body.pos.y - contactY;

    const distance = Math.hypot(dx, dy);
    const penetration = body.radius - distance;

    // Ignore numerical roundoff near exact tangency.
    // Scale the tolerance to the dimensions involved.
    const tolerance = 1e-10 * Math.max(
        1,
        body.radius,
        distance
    );

    // A tangent contact is not considered penetration.
    if (penetration <= tolerance) {
        return null;
    }

    // Normal points from pedestal toward circle.
    // When the circle center is directly on the surface,
    // choose the upward normal.
    const normal = distance > 0
        ? {
            x: dx / distance,
            y: dy / distance
        }
        : {
            x: 0,
            y: 1
        };

    return {
        pedestalId: pedestal.id,
        point: {
            x: contactX,
            y: contactY
        },
        normal,
        penetration,
        distance
    };
}


/*
 * Return the four corners of a rectangular rigid body
 * in world coordinates.
 *
 * Positive rotation is counterclockwise.
 */
export function getRectangleWorldCorners(body) {
    const geometry = body?.geometry;

    if (
        geometry?.type !== "rectangle" ||
        !Number.isFinite(geometry.width) ||
        !Number.isFinite(geometry.height) ||
        geometry.width <= 0 ||
        geometry.height <= 0 ||
        !Number.isFinite(body.angle)
    ) {
        throw new Error("Expected valid rectangular body geometry.");
    }

    const halfWidth = geometry.width / 2;
    const halfHeight = geometry.height / 2;

    const localCorners = [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight }
    ];

    return localCorners.map((point, index) => {
        const worldPoint = body.localPointToWorld(point);

        return {
            index,
            x: worldPoint.x,
            y: worldPoint.y
        };
    });
}

/*
 * Experimental rectangle-to-pedestal top contact.
 *
 * Detects rectangle corners penetrating the finite
 * horizontal top surface of a pedestal.
 *
 * This does NOT yet detect every possible edge contact
 * or apply collision forces.
 */
export function detectRectanglePedestalContact(body, pedestal) {
    if (
        !Number.isFinite(pedestal?.xMin) ||
        !Number.isFinite(pedestal?.xMax) ||
        !Number.isFinite(pedestal?.topY) ||
        pedestal.xMax <= pedestal.xMin
    ) {
        throw new Error("Invalid pedestal geometry.");
    }

    // Restrict this experimental detector to approaches
    // from above the pedestal.
    if (body.pos.y < pedestal.topY) {
        return null;
    }

    const corners = getRectangleWorldCorners(body);
    const tolerance = 1e-10;

    const contacts = corners
        .filter(corner =>
            corner.x >= pedestal.xMin - tolerance &&
            corner.x <= pedestal.xMax + tolerance &&
            corner.y < pedestal.topY - tolerance
        )
        .map(corner => ({
            cornerIndex: corner.index,
            point: {
                x: corner.x,
                y: pedestal.topY
            },
            penetration: pedestal.topY - corner.y
        }));

    if (contacts.length === 0) {
        return null;
    }

    return {
        pedestalId: pedestal.id,
        normal: { x: 0, y: 1 },
        penetration: Math.max(
            ...contacts.map(contact => contact.penetration)
        ),
        contacts
    };
}


/*
 * Detect top-surface overlap for a rotated rectangular body,
 * including cases where no rectangle corner lies over the
 * pedestal.
 *
 * Clips the rectangle to the pedestal's horizontal interval.
 * Geometry only: no forces or collision response.
 *
 * Coordinates: x right, y up, metres.
 */
export function detectRectanglePedestalSurfaceContact(
    body,
    pedestal
) {
    if (
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(pedestal?.xMin) ||
        !Number.isFinite(pedestal?.xMax) ||
        !Number.isFinite(pedestal?.topY) ||
        pedestal.xMin >= pedestal.xMax
    ) {
        throw new Error("Invalid rectangle or pedestal.");
    }

    // This remains a one-sided, top-surface detector.
    if (body.pos.y < pedestal.topY) {
        return null;
    }

    const tolerance = 1e-10;
    let polygon = getRectangleWorldCorners(body);

    // Keep the portion to the right of xMin, then
    // the portion to the left of xMax.
    function clipAtX(vertices, boundary, keepRight) {
        if (vertices.length === 0) return [];

        const inside = p => keepRight
            ? p.x >= boundary - tolerance
            : p.x <= boundary + tolerance;

        const intersection = (a, b) => {
            const dx = b.x - a.x;

            if (Math.abs(dx) < 1e-14) {
                return { x: boundary, y: a.y };
            }

            const t = (boundary - a.x) / dx;

            return {
                x: boundary,
                y: a.y + t * (b.y - a.y)
            };
        };

        const result = [];

        for (let i = 0; i < vertices.length; i++) {
            const current = vertices[i];
            const previous =
                vertices[(i + vertices.length - 1) %
                vertices.length];

            const currentInside = inside(current);
            const previousInside = inside(previous);

            if (currentInside !== previousInside) {
                result.push(intersection(previous, current));
            }

            if (currentInside) {
                result.push({
                    x: current.x,
                    y: current.y
                });
            }
        }

        return result;
    }

    polygon = clipAtX(polygon, pedestal.xMin, true);
    polygon = clipAtX(polygon, pedestal.xMax, false);

    if (polygon.length === 0) {
        return null;
    }

    const lowest = polygon.reduce(
        (a, b) => b.y < a.y ? b : a
    );

    const highest = polygon.reduce(
        (a, b) => b.y > a.y ? b : a
    );

    // The clipped body must actually cross the top plane.
    if (
        lowest.y >= pedestal.topY - tolerance ||
        highest.y < pedestal.topY - tolerance
    ) {
        return null;
    }

    return {
        pedestalId: pedestal.id,
        normal: { x: 0, y: 1 },
        point: {
            x: lowest.x,
            y: pedestal.topY
        },
        penetration: pedestal.topY - lowest.y,
        clippedPolygon: polygon
    };
}


/*
 * Experimental support-footprint geometry.
 *
 * Checks whether a rectangular artifact's bottom edge
 * is aligned with a horizontal pedestal top.
 *
 * This is a geometric test, not a contact-force solver.
 * Units are metres. Positive y points upward.
 */
export function evaluateRectanglePedestalSupport(
    body,
    pedestal,
    contactTolerance = 0.001
) {
    if (
        body?.geometry?.type !== "rectangle" ||
        !Number.isFinite(body?.pos?.x) ||
        !Number.isFinite(body?.pos?.y) ||
        !Number.isFinite(body?.angle) ||
        !Number.isFinite(pedestal?.xMin) ||
        !Number.isFinite(pedestal?.xMax) ||
        !Number.isFinite(pedestal?.topY) ||
        pedestal.xMax <= pedestal.xMin ||
        !Number.isFinite(contactTolerance) ||
        contactTolerance < 0
    ) {
        throw new Error("Invalid support geometry.");
    }

    // Existing corner order:
    // 0 = bottom left, 1 = bottom right.
    const corners = getRectangleWorldCorners(body);
    const left = corners[0];
    const right = corners[1];

    const baseMinX = Math.min(left.x, right.x);
    const baseMaxX = Math.max(left.x, right.x);

    // Horizontal intersection of base and pedestal.
    const supportMinX = Math.max(
        baseMinX,
        pedestal.xMin
    );
    const supportMaxX = Math.min(
        baseMaxX,
        pedestal.xMax
    );

    const supportWidth = Math.max(
        0,
        supportMaxX - supportMinX
    );

    // Both endpoints must lie near the top surface.
    // This intentionally rejects significantly tilted bases.
    const baseAligned =
        Math.abs(left.y - pedestal.topY)
        <= contactTolerance &&
        Math.abs(right.y - pedestal.topY)
        <= contactTolerance;

    const touching = baseAligned && supportWidth > 0;

    const baseFullyOnPedestal =
        touching &&
        baseMinX >= pedestal.xMin - contactTolerance &&
        baseMaxX <= pedestal.xMax + contactTolerance;

    // For our current uniform test rectangles, body.pos
    // represents the center of mass.
    const comWithinSupport =
        touching &&
        body.pos.x >= supportMinX &&
        body.pos.x <= supportMaxX;

    return {
        pedestalId: pedestal.id,
        touching,
        baseAligned,
        baseFullyOnPedestal,
        comWithinSupport,

        supportWidth,

        baseInterval: {
            min: baseMinX,
            max: baseMaxX
        },

        supportInterval: {
            min: supportMinX,
            max: supportMaxX
        },

        comX: body.pos.x
    };
}
