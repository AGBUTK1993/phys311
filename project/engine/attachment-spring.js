// Experimental tension-only elastic connector.
// Not yet connected to the playable suspension worlds.
//
// A massless connector pulls a body toward a fixed anchor.
// It cannot push when slack.
//
// x and y are in metres, stiffness in N/m.

export function applyAttachmentSpring(
    body,
    localPoint,
    anchor,
    { stiffness, restLength }
) {
    if (
        !Number.isFinite(stiffness) || stiffness <= 0 ||
        !Number.isFinite(restLength) || restLength <= 0 ||
        !Number.isFinite(anchor?.x) ||
        !Number.isFinite(anchor?.y)
    ) {
        throw new Error("Invalid attachment spring parameters.");
    }

    // Transform the body's attachment into world coordinates.
    const point = body.localPointToWorld(localPoint);

    const dx = anchor.x - point.x;
    const dy = anchor.y - point.y;
    const length = Math.hypot(dx, dy);

    const extension = Math.max(0, length - restLength);
    const tension = stiffness * extension;

    if (tension > 0 && length > 0) {
        body.applyForceAtPoint(
            {
                x: tension * dx / length,
                y: tension * dy / length
            },
            point
        );
    }

    return {
        length,
        extension,
        tension,
        elasticEnergy: 0.5 * stiffness * extension ** 2
    };
}