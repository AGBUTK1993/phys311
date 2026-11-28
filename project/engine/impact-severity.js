
/*
 * Phase 5D.2 — Experimental impact severity.
 *
 * Converts measured impact quantities into configurable
 * gameplay intensity categories.
 *
 * Does not predict fracture or material damage.
 * Does not modify the collision or body.
 *
 * SI units:
 * speed: m/s
 * energy: J
 * impulse: N s
 */

export const DEFAULT_IMPACT_SEVERITY = Object.freeze({
    minImpactSpeed: 0.1,
    energyModerate: 1,
    energyHigh: 5,
    impulseModerate: 2,
    impulseHigh: 5
});

export function classifyImpactSeverity(
    analysis,
    thresholds = DEFAULT_IMPACT_SEVERITY
) {
    if (analysis === null) return null;

    const {
        minImpactSpeed,
        energyModerate,
        energyHigh,
        impulseModerate,
        impulseHigh
    } = thresholds ?? {};

    const validThresholds = [
        minImpactSpeed,
        energyModerate,
        energyHigh,
        impulseModerate,
        impulseHigh
    ].every(Number.isFinite);

    if (
        !validThresholds ||
        minImpactSpeed < 0 ||
        energyModerate <= 0 ||
        energyHigh <= energyModerate ||
        impulseModerate <= 0 ||
        impulseHigh <= impulseModerate
    ) {
        throw new Error("Invalid impact severity thresholds.");
    }

    const speed = analysis?.incomingNormalSpeed;
    const energy = analysis?.normalEnergyBefore;
    const impulse = analysis?.normalImpulse;

    if (
        !Number.isFinite(speed) ||
        !Number.isFinite(energy) ||
        !Number.isFinite(impulse) ||
        speed < 0 ||
        energy < 0 ||
        impulse < 0
    ) {
        throw new Error("Invalid impact measurements.");
    }

    // Ignore very small impact events.
    // This is event filtering, not proof of safety.
    if (speed < minImpactSpeed) {
        return {
            intensity: "ignored",
            rank: 0,
            counted: false,
            incomingNormalSpeed: speed,
            incomingNormalEnergy: energy,
            normalImpulse: impulse
        };
    }

    function rank(value, moderate, high) {
        if (value >= high) return 3;
        if (value >= moderate) return 2;
        return 1;
    }

    const energyRank = rank(
        energy,
        energyModerate,
        energyHigh
    );

    const impulseRank = rank(
        impulse,
        impulseModerate,
        impulseHigh
    );

    const overallRank = Math.max(
        energyRank,
        impulseRank
    );

    const labels = [
        "ignored",
        "low",
        "moderate",
        "high"
    ];

    return {
        intensity: labels[overallRank],
        rank: overallRank,
        counted: true,

        energyCategory: labels[energyRank],
        impulseCategory: labels[impulseRank],

        incomingNormalSpeed: speed,
        incomingNormalEnergy: energy,
        normalImpulse: impulse
    };
}
