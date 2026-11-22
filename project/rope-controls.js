export function createRopeControls({
    getWorld,
    canAdjust,
    bottom,
    settings
}) {
    const label = document.createElement("label");
    label.className = "rope-length-control";
    label.textContent = "Rope length: ";

    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = "0.8";
    slider.max = "4.5";
    slider.step = "0.05";
    slider.setAttribute(
        "aria-label",
        "Target rope length in metres"
    );

    const readout = document.createElement("output");
    label.append(slider, readout);
    bottom.append(label);

    const strengthLabel = document.createElement("label");
    strengthLabel.textContent = "Rope breaking tension (N): ";

    const strength = document.createElement("input");
    strength.type = "number";
    strength.min = "5";
    strength.max = "200";
    strength.step = "1";
    strength.value = "35";

    strengthLabel.append(strength);
    settings.append(strengthLabel);

    const feedback = document.createElement("p");
    feedback.className = "rope-feedback";
    bottom.append(feedback);

    slider.addEventListener("input", () => {
        const world = getWorld();

        if (canAdjust() && world?.ropeState !== "broken") {
            world.lengthTarget = Number(slider.value);
        }
    });

    strength.addEventListener("change", () => {
        const world = getWorld();
        const value = Number(strength.value);

        if (
            !world ||
            world.conservativeMode ||
            !Number.isFinite(value)
        ) return;

        world.breakStrength = Math.max(5, Math.min(200, value));
        strength.value = String(world.breakStrength);
    });

    let previousWorld;

    return function syncRopeControls() {
        const world = getWorld();
        const active = !!world?.ropeState;

        label.hidden = !active;
        strengthLabel.hidden = !active;
        feedback.hidden = !active;

        if (!active) return;

        if (world !== previousWorld) {
            previousWorld = world;
            strength.value = String(world.breakStrength);
        }

        slider.value = String(world.lengthTarget);
        slider.disabled =
            !canAdjust() || world.ropeState === "broken";

        strength.disabled =
            world.conservativeMode || world.ropeState === "broken";

        readout.textContent = `${world.length.toFixed(2)} m`;

        feedback.textContent = world.ropeState === "broken"
            ? "Rope broken — Restart this chamber."
            : `${world.ropeState} · ` +
              `${world.tension.toFixed(1)} / ${world.breakStrength} N`;
    };
}