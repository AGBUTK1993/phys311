// Chamber definitions only; physics remains in engine/suspension.js.
export const LIFT_LEVELS = [
    {
        id: "first-delivery",
        name: "1 — First delivery",
        hint: "Guide the artifact right and let its swing settle inside the zone.",
        startX: 0,
        theta: 0.2,
        dampingRate: 0.35,
        zone: {
            xMin: 1.2,
            xMax: 2.8,
            yMin: -1.6,
            yMax: -0.4,
        },
    },
    {
        id: "return-passage",
        name: "2 — Return passage",
        hint: "Deliver to the left. The narrower zone rewards gentle corrections.",
        startX: 2,
        theta: -0.15,
        dampingRate: 0.35,
        zone: {
            xMin: -2.8,
            xMax: -1.8,
            yMin: -1.6,
            yMax: -0.4,
        },
    },
    {
        id: "steady-hands",
        name: "3 — Steady hands",
        hint: "Cross the chamber to the right. Weaker damping makes the swing take longer to settle.",
        startX: -2.5,
        theta: 0.1,
        dampingRate: 0.18,
        zone: {
            xMin: 2.0,
            xMax: 2.8,
            yMin: -1.6,
            yMax: -0.4,
        },
    },
];