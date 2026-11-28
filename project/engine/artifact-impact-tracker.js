
/*
 * Phase 5D.4 — Cumulative artifact impact tracking.
 *
 * Stores independent, measured impact events.
 *
 * The accumulated exposure is a GAMEPLAY index,
 * not measured damage, crack growth, or fracture.
 *
 * Caller must provide a unique eventId for each
 * genuinely separate collision event.
 */

export function createArtifactImpactTracker({
    artifactId,
    minimumExposure = 0.1
}) {
    if (
        typeof artifactId !== "string" ||
        artifactId.trim() === "" ||
        !Number.isFinite(minimumExposure) ||
        minimumExposure < 0
    ) {
        throw new Error("Invalid impact tracker configuration.");
    }

    return {
        artifactId,
        minimumExposure,
        totalExposure: 0,
        recordedImpacts: 0,
        filteredImpacts: 0,
        lastProcessedTime: -Infinity,
        seenEventIds: new Set(),
        events: []
    };
}

export function recordArtifactImpact(
    tracker,
    {
        eventId,
        time,
        severity,
        exposure
    }
) {
    if (
        !tracker ||
        !(tracker.seenEventIds instanceof Set) ||
        !Array.isArray(tracker.events) ||
        typeof eventId !== "string" ||
        eventId.trim() === "" ||
        !Number.isFinite(time) ||
        time < 0 ||
        !severity ||
        typeof severity.counted !== "boolean" ||
        !exposure ||
        exposure.artifactId !== tracker.artifactId ||
        exposure.model !== "experimental-gameplay-exposure-v1" ||
        !Number.isFinite(exposure.exposureScore) ||
        exposure.exposureScore < 0
    ) {
        throw new Error("Invalid impact tracking event.");
    }

    if (tracker.seenEventIds.has(eventId)) {
        return {
            accepted: false,
            reason: "duplicate-event",
            totalExposure: tracker.totalExposure
        };
    }

    if (time < tracker.lastProcessedTime) {
        throw new Error("Impact events must be time ordered.");
    }

    tracker.seenEventIds.add(eventId);
    tracker.lastProcessedTime = time;

    if (
        !severity.counted ||
        exposure.exposureScore <
            tracker.minimumExposure
    ) {
        tracker.filteredImpacts++;

        return {
            accepted: false,
            reason: !severity.counted
                ? "ignored-impact"
                : "below-exposure-threshold",
            totalExposure: tracker.totalExposure
        };
    }

    const event = Object.freeze({
        eventId,
        time,
        exposureScore: exposure.exposureScore,
        exposureLevel: exposure.exposureLevel,
        severity: severity.intensity
    });

    tracker.events.push(event);
    tracker.recordedImpacts++;
    tracker.totalExposure += event.exposureScore;

    return {
        accepted: true,
        reason: "recorded",
        totalExposure: tracker.totalExposure,
        recordedImpacts: tracker.recordedImpacts
    };
}

export function getArtifactImpactSummary(tracker) {
    if (
        !tracker ||
        !Array.isArray(tracker.events) ||
        !(tracker.seenEventIds instanceof Set)
    ) {
        throw new Error("Invalid impact tracker.");
    }

    return Object.freeze({
        artifactId: tracker.artifactId,
        totalExposure: tracker.totalExposure,
        recordedImpacts: tracker.recordedImpacts,
        filteredImpacts: tracker.filteredImpacts,
        processedEvents: tracker.seenEventIds.size,
        events: Object.freeze([...tracker.events])
    });
}
