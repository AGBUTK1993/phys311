
/*
 * Experimental pedestal geometry.
 *
 * x is the horizontal center.
 * topY is the height of the supporting surface.
 * width and height are in metres.
 *
 * Geometry only: no collision response or friction yet.
 */

export function createPedestal({
    id,
    x,
    topY,
    width,
    height
}) {
    if (
        typeof id !== "string" ||
        id.trim() === "" ||
        !Number.isFinite(x) ||
        !Number.isFinite(topY) ||
        !Number.isFinite(width) ||
        !Number.isFinite(height) ||
        width <= 0 ||
        height <= 0
    ) {
        throw new Error("Invalid pedestal definition.");
    }

    return Object.freeze({
        id,
        x,
        topY,
        width,
        height,

        xMin: x - width / 2,
        xMax: x + width / 2,

        yMin: topY - height,
        yMax: topY
    });
}
