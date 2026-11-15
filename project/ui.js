// Connect playback controls to functions supplied by main.js.
export function wirePlaybackExtras({ onStep, onSpeedChange }) {
    const stepButton = document.getElementById("stepButton");
    const speedInput = document.getElementById("speedInput");
    const speedValue = document.getElementById("speedValue");

    stepButton.addEventListener("click", onStep);

    speedInput.addEventListener("input", () => {
        const parsed = parseFloat(speedInput.value);

        // Keep the speed within the supported range.
        const speed = Number.isFinite(parsed)
            ? Math.max(0.25, Math.min(2, parsed))
            : 1;

        speedInput.value = String(speed);
        speedValue.textContent = speed.toFixed(2);
        onSpeedChange(speed);
    });
}

// Keyboard shortcuts activate the same controls as mouse clicks.
export function wireKeyboardControls() {
    const pauseButton = document.getElementById("pauseButton");
    const stepButton = document.getElementById("stepButton");
    const restartButton = document.getElementById("restartButton");
    const speedInput = document.getElementById("speedInput");
    const integratorSelect =
        document.getElementById("integratorSelect");

    window.addEventListener("keydown", (event) => {
        // Preserve browser shortcuts and avoid repeated reset/step actions.
        if (
            event.ctrlKey ||
            event.metaKey ||
            event.altKey ||
            event.repeat
        ) {
            return;
        }

        // Let focused HTML controls keep their normal keyboard behavior.
        const target = event.target;

        if (
            target instanceof HTMLElement &&
            (
                target.closest("input, select, textarea, button, summary") ||
                target.isContentEditable
            )
        ) {
            return;
        }

        const key = event.key.toLowerCase();

        if (event.code === "Space") {
            event.preventDefault();
            pauseButton.click();
        } else if (key === ".") {
            event.preventDefault();
            stepButton.click();
        } else if (key === "r") {
            event.preventDefault();
            restartButton.click();
        } else if (["-", "_", "+", "="].includes(key)) {
            event.preventDefault();

            if (speedInput.disabled) return;

            const direction = key === "-" || key === "_" ? -1 : 1;
            const current = parseFloat(speedInput.value);

            speedInput.value = String(
                Math.max(0.25, Math.min(2, current + direction * 0.25))
            );

            speedInput.dispatchEvent(
                new Event("input", { bubbles: true })
            );
        } else if (key === "i") {
            event.preventDefault();

            if (integratorSelect.disabled) return;

            integratorSelect.selectedIndex =
                (integratorSelect.selectedIndex + 1) %
                integratorSelect.options.length;

            integratorSelect.dispatchEvent(
                new Event("change", { bubbles: true })
            );
        }
    });
}

// Parse and clamp physical parameters before passing them to main.js.
export function wirePhysicsSliders({ onChange }) {
    const gravityInput = document.getElementById("gravityInput");
    const gravityValue = document.getElementById("gravityValue");
    const stiffnessInput = document.getElementById("stiffnessInput");
    const stiffnessValue = document.getElementById("stiffnessValue");

    function updateGravity() {
        const parsed = parseFloat(gravityInput.value);
        const value = Number.isFinite(parsed)
            ? Math.max(0, Math.min(10, parsed))
            : 0;

        gravityInput.value = String(value);
        gravityValue.textContent = value.toFixed(2);
        onChange();
    }

    function updateStiffness() {
        const parsed = parseFloat(stiffnessInput.value);
        const value = Number.isFinite(parsed)
            ? Math.max(1, Math.min(40, parsed))
            : 10;

        stiffnessInput.value = String(value);
        stiffnessValue.textContent = value.toFixed(1);
        onChange();
    }

    gravityInput.addEventListener("input", updateGravity);
    stiffnessInput.addEventListener("input", updateStiffness);
}