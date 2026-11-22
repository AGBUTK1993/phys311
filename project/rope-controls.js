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

    const gearRow = document.createElement("div");
    gearRow.className = "winch-gear-controls";
    gearRow.setAttribute("role", "group");
    gearRow.setAttribute("aria-label", "Winch gear");

    const gearDown = document.createElement("button");
    gearDown.type = "button";
    gearDown.textContent = "−";
    gearDown.setAttribute("aria-label", "Lower winch gear");

    const gearReadout = document.createElement("output");
    gearReadout.setAttribute("aria-live", "polite");

    const gearUp = document.createElement("button");
    gearUp.type = "button";
    gearUp.textContent = "+";
    gearUp.setAttribute("aria-label", "Higher winch gear");

    function changeGear(direction) {
        const world = getWorld();

        if (
            !canAdjust() ||
            !world?.winchGears ||
            world.ropeState === "broken"
        ) return;

        world.winchGear = Math.max(
            0,
            Math.min(
                world.winchGears.length - 1,
                world.winchGear + direction
            )
        );
    }

    gearDown.addEventListener("click", () => changeGear(-1));
    gearUp.addEventListener("click", () => changeGear(1));

    gearRow.append(gearDown, gearReadout, gearUp);
    bottom.append(gearRow);

    const strengthLabel = document.createElement("label");
    strengthLabel.textContent = "Rope breaking tension (N): ";

    const strength = document.createElement("input");
    strength.type = "number";
    strength.min = "5";
    strength.max = "200";
    strength.step = "1";
    strength.value = "";

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
        gearRow.hidden = !active;

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

        const gear = world.winchGears[world.winchGear];

        const gearText =
            `Gear ${world.winchGear + 1}: ${gear.name} · ` +
            `${gear.speed.toFixed(2)} m/s`;

        if (gearReadout.textContent !== gearText) {
            gearReadout.textContent = gearText;
        }

        const gearLocked =
            !canAdjust() || world.ropeState === "broken";

        gearDown.disabled = gearLocked || world.winchGear === 0;
        gearUp.disabled =
            gearLocked ||
            world.winchGear === world.winchGears.length - 1;

        feedback.textContent = world.ropeState === "broken"
            ? "Rope broken — Restart this chamber."
            : `${world.ropeState} · ` +
            `${world.tension.toFixed(1)} / ${world.breakStrength} N`;
    };
}