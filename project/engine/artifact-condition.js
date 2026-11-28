
/*
 * Phase 5D.5 — Experimental artifact condition rules.
 *
 * Converts accumulated GAMEPLAY exposure into:
 * - condition category
 * - preservation score
 * - warning/failure recommendation
 *
 * Does not predict physical cracks or fracture.
 * Does not alter simulation state.
 */

export const DEFAULT_CONDITION_RULES = Object.freeze({
    cautionExposure: 0.5,
    criticalExposure: 1.5,
    failureExposure: 3
});

export function createArtifactConditionRules({
    cautionExposure,
    criticalExposure,
    failureExposure
}) {
    if (
        !Number.isFinite(cautionExposure) ||
        !Number.isFinite(criticalExposure) ||
        !Number.isFinite(failureExposure) ||
        cautionExposure <= 0 ||
        criticalExposure <= cautionExposure ||
        failureExposure <= criticalExposure
    ) {
        throw new Error("Invalid artifact condition rules.");
    }

    return Object.freeze({
        cautionExposure,
        criticalExposure,
        failureExposure
    });
}

export function evaluateArtifactCondition(
    summary,
    rules = DEFAULT_CONDITION_RULES
) {
    if (
        !summary ||
        typeof summary.artifactId !== "string" ||
        summary.artifactId.trim() === "" ||
        !Number.isFinite(summary.totalExposure) ||
        summary.totalExposure < 0 ||
        !Number.isSafeInteger(summary.recordedImpacts) ||
        summary.recordedImpacts < 0 ||
        !Number.isSafeInteger(summary.filteredImpacts) ||
        summary.filteredImpacts < 0
    ) {
        throw new Error("Invalid artifact impact summary.");
    }

    // Validate all rule sets, including caller-supplied ones.
    const validated = createArtifactConditionRules(
        rules ?? {}
    );

    const exposure = summary.totalExposure;
    let condition;
    let action;

    if (exposure >= validated.failureExposure) {
        condition = "failed";
        action = "fail-attempt";
    } else if (exposure >= validated.criticalExposure) {
        condition = "critical";
        action = "critical-warning";
    } else if (exposure >= validated.cautionExposure) {
        condition = "caution";
        action = "caution-warning";
    } else {
        condition = "clear";
        action = "continue";
    }

    const preservationScore = 100 * Math.max(
        0,
        1 - exposure / validated.failureExposure
    );

    return Object.freeze({
        artifactId: summary.artifactId,
        model: "experimental-gameplay-condition-v1",

        condition,
        action,
        failed: condition === "failed",

        totalExposure: exposure,
        preservationScore,

        recordedImpacts: summary.recordedImpacts,
        filteredImpacts: summary.filteredImpacts,

        rules: validated,
        predictsPhysicalDamage: false
    });
}
