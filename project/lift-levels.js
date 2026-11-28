// Chamber definitions only; physics remains in engine/suspension.js.
export const LIFT_LEVELS = [
    {
        id: "first-delivery",
        name: "1 — First delivery",
        hint: "Guide the artifact right and let its swing settle inside the zone.",
        startX: 0,
        theta: 0.2,
        dampingRate: 0.35,

        artifact: {
            id: "practice-load-1",
            name: "Training artifact",

            // Physical properties currently used by the simulation.
            mass: 2,

            // Dimensions are expressed in metres.
            // The current training artifact is modeled as a disk.
            geometry: {
                type: "disk",
                radius: 0.22,
            },
        },
        ropeBreakingStrength: 22,

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

        artifact: {
            id: "practice-load-2",
            name: "Passage artifact",

            // Physical properties currently used by the simulation.
            mass: 2,

            // Dimensions are expressed in metres.
            // The current training artifact is modeled as a disk.
            geometry: {
                type: "disk",
                radius: 0.22,
            },
        },
        ropeBreakingStrength: 22,

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

        artifact: {
            id: "practice-load-3",
            name: "Precision artifact",

            // Physical properties currently used by the simulation.
            mass: 2,

            // Dimensions are expressed in metres.
            // The current training artifact is modeled as a disk.
            geometry: {
                type: "disk",
                radius: 0.22,
            },
        },
        ropeBreakingStrength: 22,

        // Deliberately gentler gearing for a precision chamber.
        winchGears: [
            {
                name: "Fine",
                speed: 0.15,
                acceleration: 0.20
            },
            {
                name: "Normal",
                speed: 0.35,
                acceleration: 0.65
            },
            {
                name: "Fast",
                speed: 0.70,
                acceleration: 1.80
            }
        ],

        zone: {
            xMin: 2.0,
            xMax: 2.8,
            yMin: -1.6,
            yMax: -0.4,
        },
    },
    {
        id: "upper-gallery",
        name: "4 — Upper gallery",
        hint: "Move right and raise the rail with W/↑ or the ▲ touch button. S/↓ or ▼ lowers it. Settle the whole artifact inside the raised zone.",
        startX: -2,
        theta: 0.1,
        dampingRate: 0.35,
        verticalEnabled: true,

        artifact: {
            id: "practice-load-4",
            name: "Gallery artifact",
            mass: 2,
            radius: 0.22,
        },
        artifact: {
            id: "practice-load-4",
            name: "Gallery artifact",

            // Physical properties currently used by the simulation.
            mass: 2,

            // Dimensions are expressed in metres.
            // The current training artifact is modeled as a disk.
            geometry: {
                type: "disk",
                radius: 0.22,
            },
        },
        ropeBreakingStrength: 22,

        zone: {
            xMin: 1.2,
            xMax: 2.8,
            yMin: 0.6,
            yMax: 1.8,
        },
    },
];